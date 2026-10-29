"""Layer 4: semantic memory. Entries are dated so stale ones can be aged out."""

from __future__ import annotations

from datetime import date

from .models import Profile

SECTIONS = ["Avatar & Calibration", "Framing Preferences", "Known Weak Spots", "Conversation Notes"]
STALE_AFTER_DAYS = 90
MAX_ENTRIES = 30


def add_entry(profile: Profile, section: str, text: str, today: date) -> bool:
    """Add a memory entry; returns False if an identical one already exists (refreshes its date)."""
    if section not in SECTIONS:
        section = "Conversation Notes"
    for e in profile.memory:
        if e["section"] == section and e["text"].lower() == text.lower():
            e["created"] = today.isoformat()
            return False
    profile.memory.append({"section": section, "text": text, "created": today.isoformat()})
    profile.memory = profile.memory[-MAX_ENTRIES:]
    return True


def is_stale(entry: dict, today: date) -> bool:
    return (today - date.fromisoformat(entry["created"])).days > STALE_AFTER_DAYS


def active_entries(profile: Profile, today: date) -> list[dict]:
    return [e for e in profile.memory if not is_stale(e, today)]


def render(profile: Profile, today: date) -> str:
    """Markdown document injected into the prompt. Stale entries are excluded, not trusted."""
    entries = active_entries(profile, today)
    if not entries:
        return ""
    lines = []
    for section in SECTIONS:
        items = [e["text"] for e in entries if e["section"] == section]
        if items:
            lines.append(f"## {section}")
            lines.extend(f"- {t}" for t in items)
    return "\n".join(lines)
