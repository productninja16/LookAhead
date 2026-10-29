"""Thin Anthropic wrapper. Every caller must also have a deterministic fallback."""

from __future__ import annotations

import json
import os
import re

FAST_MODEL = os.getenv("LOOKAHEAD_FAST_MODEL", "claude-haiku-5-5")
SMART_MODEL = os.getenv("LOOKAHEAD_SMART_MODEL", "claude-sonnet-5-5")


class LLMError(Exception):
    pass


def available() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def complete(model: str, system: str, user: str, max_tokens: int = 700) -> str:
    if not available():
        raise LLMError("no API key configured")
    try:
        from anthropic import Anthropic

        client = Anthropic(timeout=20.0, max_retries=1)
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    except Exception as e:  # network, rate limit, bad model id, etc.
        raise LLMError(str(e)) from e


def extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise LLMError("no JSON object in model output")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise LLMError(f"invalid JSON: {e}") from e
