from datetime import date, timedelta

from app.core import grounding, memory, tools, verdict
from app.core.classifier import classify_rules, parse_amount
from app.core.demo_data import build
from app.core.engine import recalculate
from evals.classifier_cases import CASES

TODAY = date(2026, 3, 1)


def test_classifier_labelled_set_meets_target():
    wrong = [(q, e, classify_rules(q)["intent"]) for q, e, _ in CASES if classify_rules(q)["intent"] != e]
    assert 1 - len(wrong) / len(CASES) >= 0.9, wrong


def test_classifier_holdout_set():
    from evals.holdout_cases import HOLDOUT

    wrong = [(q, e, classify_rules(q)["intent"]) for q, e in HOLDOUT if classify_rules(q)["intent"] != e]
    assert not wrong, wrong


def test_item_extraction_never_yields_a_bare_generic_noun():
    assert classify_rules("Can I afford a $549 purchase?")["item"] == "this purchase"
    assert "headphones" in classify_rules("Can I afford $549 headphones?")["item"]


def test_parse_amount():
    assert parse_amount("a $1,500 phone") == 1500
    assert parse_amount("$5k bonus") == 5000
    assert parse_amount("no money here") is None


def test_grounding_flags_invented_numbers():
    p = build("dev", TODAY)
    snap = recalculate(p, TODAY)
    known = grounding.known_numbers(p, snap)
    ok = grounding.check(f"Your rent of $2,300 is due soon.", known)
    assert ok["references_user_numbers"] and not ok["ungrounded"]
    bad = grounding.check("You will save $9,876 a month.", known)
    assert bad["ungrounded"] == [9876.0]


def test_verdict_label_is_computed_by_code_not_llm():
    p = build("sam", TODAY)
    snap = recalculate(p, TODAY)
    f = verdict.compute_facts(p, snap, 549, "headphones", TODAY)
    assert f["verdict"] == "not_now"  # $549 > Sam's safe-to-spend
    cheap = verdict.compute_facts(p, snap, 10, "coffee", TODAY)
    assert cheap["verdict"] in {"yes", "caution"}


def test_llm_output_with_hallucinated_number_is_rejected(monkeypatch):
    from app.core import llm

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(
        llm,
        "complete",
        lambda *a, **k: '{"directAnswer": "Sure, you will still have $77,777 left.", "tradeoffs": [], '
        '"risksOrCaution": "", "nextStep": "Go ahead.", "followUps": []}',
    )
    p = build("dev", TODAY)
    v = verdict.make_verdict(p, recalculate(p, TODAY), 549, "headphones", TODAY, [], use_llm=True)
    assert v["source"] == "fallback" and v["llm_rejected"] is True
    assert "77,777" not in v["directAnswer"]


def test_llm_output_that_is_grounded_is_used(monkeypatch):
    from app.core import llm

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(
        llm,
        "complete",
        lambda *a, **k: '{"directAnswer": "Yes, $549 fits.", "tradeoffs": ["It is a modest dent."], '
        '"risksOrCaution": "", "nextStep": "Wait a day.", "followUps": []}',
    )
    p = build("dev", TODAY)
    v = verdict.make_verdict(p, recalculate(p, TODAY), 549, "headphones", TODAY, [], use_llm=True)
    assert v["source"] == "llm"


def test_mark_paid_rolls_due_date_and_deducts_cash():
    p = build("maya", TODAY)
    prop = tools.propose(p, "I paid my rent today.")
    assert prop and prop.action == "mark_paid"
    p2 = tools.apply(p, prop)
    rent_before = next(o for o in p.obligations if o.id == "rent")
    rent_after = next(o for o in p2.obligations if o.id == "rent")
    assert rent_after.next_due > rent_before.next_due
    assert p2.checking_balance == p.checking_balance - rent_before.amount
    assert p.checking_balance == build("maya", TODAY).checking_balance  # original untouched


def test_memory_staleness_excludes_old_entries():
    p = build("maya", TODAY)
    memory.add_entry(p, "Known Weak Spots", "Impulse-buys gadgets", TODAY - timedelta(days=200))
    memory.add_entry(p, "Known Weak Spots", "Overspends on delivery", TODAY)
    rendered = memory.render(p, TODAY)
    assert "delivery" in rendered and "gadgets" not in rendered
