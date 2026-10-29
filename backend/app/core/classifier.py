"""Intent classification. Haiku does it when available; explicit rules are the deterministic fallback
(and what the labelled eval set in evals/ measures)."""

from __future__ import annotations

import re

from . import llm

INTENTS = ("purchase_check", "conversational", "tool_call", "semantic_update")

_MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)\s?([kK])?|\b(\d[\d,]*(?:\.\d+)?)\s?(?:dollars|bucks)\b")

HYPO = re.compile(
    r"\b(what if|what would happen if|if i (got|get|were|was|had|bought|buy|took|take|made|make|"
    r"landed|lost)|thinking (of|about)|considering|hypothetically|how would|would my)\b",
    re.I,
)
RETRO = re.compile(
    r"\bi (just |already )?(bought|purchased|ordered|spent)\b|\bwas that a\b|\bdid i make the right\b", re.I
)
SEMANTIC = re.compile(
    r"\bi (always|usually|tend to|often|keep|can'?t help)\b|\bmy (weakness|problem) is\b|"
    r"\bi('m| am) (bad|terrible) with\b|\bi (over ?spend|overspent|impulse|splurge|stress[- ]?(buy|spend|shop))\w*",
    re.I,
)
TOOL = re.compile(
    r"\bi (just |already )?(paid|received|got paid|cancell?ed|canceled)\b|"
    r"\bi got an? (\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]? )?(raise|bonus|salary hike|promotion|pay ?raise)\b|"
    r"\b(raised|increased|lowered|dropped) my [a-z ]{2,25} to\b|"
    r"\bi('m| am) now (making|earning)\b|\bi (now )?(make|earn) \$|"
    r"\bmy [a-z][a-z ]{1,25} (is|are) (now )?\$|\b(update|change|set) my\b",
    re.I,
)
PURCHASE = re.compile(
    r"\b(can i|could i|should i|may i|am i able to|do i have (enough|room)|afford|buy|purchase|get|"
    r"order|pay for|need to pay|too much|worth|splurge|financ(e|ing)|affirm|klarna|installments?|"
    r"pay (upfront|in full)|book|reasonable|smart to|over budget|swing|enough saved)\b",
    re.I,
)
_ITEM = re.compile(
    r"\b(?:buy|get|purchase|afford|order|book|splurge on|spend on|for|on)\s+(?:a|an|the|some|these|those|my)?\s*"
    r"(?:\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?\s*)?([a-z][a-z0-9' \-]{2,40}?)"
    r"(?=\s*(?:right now|today|this|next|on |with |and |\?|\.|,|$))",
    re.I,
)


def parse_amount(text: str) -> float | None:
    m = _MONEY.search(text)
    if not m:
        return None
    raw = (m.group(1) or m.group(3)).replace(",", "")
    value = float(raw)
    if m.group(2):
        value *= 1000
    return value


def extract_item(text: str) -> str:
    m = _ITEM.search(text)
    if m:
        item = m.group(1).strip(" -")
        generic = {"purchase", "thing", "one", "stuff", "something", "item"}
        if item and item.lower() not in generic and not item.lower().startswith(("it", "that", "this")):
            return item
    return "this purchase"


def classify_rules(text: str) -> dict:
    """Order matters: hypotheticals and retrospectives must beat amount + purchase-verb matches."""
    t = text.strip()
    amount = parse_amount(t)
    if HYPO.search(t) or RETRO.search(t):
        intent = "conversational"
    elif SEMANTIC.search(t):
        intent = "semantic_update"
    elif TOOL.search(t):
        intent = "tool_call"
    elif amount is not None and PURCHASE.search(t):
        intent = "purchase_check"
    else:
        intent = "conversational"
    return {
        "intent": intent,
        "amount": amount,
        "item": extract_item(t) if intent == "purchase_check" else None,
        "source": "rules",
    }


_SYSTEM = """You classify one user message to a personal-finance assistant into exactly one intent.
- purchase_check: asks whether they can/should buy or pay for something AND names an amount, in present or future tense.
- tool_call: reports a CONFIRMED change (paid a bill, got a raise/bonus, cancelled something, states a new amount for a bill/income).
- semantic_update: states a lasting habit or tendency about themselves ("I tend to impulse buy...").
- conversational: everything else, including hypotheticals ("what if", "thinking of"), retrospective reflection on past purchases, explanations, and a bare amount with no context.
Reply with JSON only: {"intent": "...", "amount": number or null, "item": short noun phrase or null}."""


def classify(text: str, use_llm: bool) -> dict:
    rules = classify_rules(text)
    if not use_llm:
        return rules
    try:
        data = llm.extract_json(llm.complete(llm.FAST_MODEL, _SYSTEM, text, max_tokens=120))
        intent = data.get("intent")
        if intent not in INTENTS:
            return rules
        amount = data.get("amount")
        amount = float(amount) if isinstance(amount, (int, float)) else rules["amount"]
        if intent == "purchase_check" and amount is None:
            return {**rules, "intent": "conversational"}
        return {
            "intent": intent,
            "amount": amount,
            "item": data.get("item") or rules["item"] or ("this purchase" if intent == "purchase_check" else None),
            "source": "llm",
        }
    except (llm.LLMError, ValueError, TypeError):
        return rules
