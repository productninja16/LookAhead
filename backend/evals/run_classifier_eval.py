"""Run the labelled set against the classifier and report accuracy + mismatches.

Usage: python -m evals.run_classifier_eval [--llm]
Rules-only by default (deterministic, no API key). --llm exercises the Haiku path.
"""

from __future__ import annotations

import sys
from collections import Counter

from app.core.classifier import classify
from evals.classifier_cases import CASES


def run(use_llm: bool = False) -> dict:
    wrong, hard_total, hard_ok = [], 0, 0
    per_intent: Counter = Counter()
    per_intent_ok: Counter = Counter()
    for query, expected, hard in CASES:
        got = classify(query, use_llm)["intent"]
        per_intent[expected] += 1
        ok = got == expected
        per_intent_ok[expected] += ok
        if hard:
            hard_total += 1
            hard_ok += ok
        if not ok:
            wrong.append((query, expected, got))
    total = len(CASES)
    return {
        "total": total,
        "accuracy": (total - len(wrong)) / total,
        "hard_edge_accuracy": hard_ok / hard_total,
        "per_intent": {k: f"{per_intent_ok[k]}/{v}" for k, v in per_intent.items()},
        "mismatches": wrong,
    }


def run_holdout(use_llm: bool = False) -> tuple[int, int]:
    from evals.holdout_cases import HOLDOUT

    ok = sum(classify(q, use_llm)["intent"] == e for q, e in HOLDOUT)
    return ok, len(HOLDOUT)


if __name__ == "__main__":
    r = run("--llm" in sys.argv)
    h_ok, h_total = run_holdout("--llm" in sys.argv)
    print(f"Holdout set:         {h_ok}/{h_total} (first run before rule fixes: 10/16 = 62.5%)")
    print(f"Classifier accuracy: {r['accuracy']:.1%} on {r['total']} queries (target >= 90%)")
    print(f"Hard edge cases:     {r['hard_edge_accuracy']:.1%}")
    print("Per intent:", r["per_intent"])
    for q, exp, got in r["mismatches"]:
        print(f"  MISS  {q!r}: expected {exp}, got {got}")
    sys.exit(0 if r["accuracy"] >= 0.9 else 1)
