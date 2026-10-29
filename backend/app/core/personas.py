"""Identity-first personalisation: the avatar changes emphasis and urgency, not just tone."""

from __future__ import annotations

from .models import Avatar

PERSONAS = {
    Avatar.strategist: {
        "label": "The Strategist",
        "identity": "Money is a tool. I want to use it precisely.",
        "voice": "Data-first. Open with the numbers (\"The numbers suggest...\"), then the trade-offs, "
        "then the caution. Show the buffer and goal impact explicitly.",
    },
    Avatar.adventurer: {
        "label": "The Adventurer",
        "identity": "Life comes first. I'll figure the money part out.",
        "voice": "Bottom-line first (\"Main thing to watch out for...\"). Short and plain. One clear "
        "warning if something could cause a problem. Always state the cost in days of daily budget "
        "so the spend feels real.",
    },
    Avatar.builder: {
        "label": "The Builder",
        "identity": "I'm working toward something. I want to see my progress.",
        "voice": "Progress-framed (\"This moves you closer to...\" / \"This sets you back...\"). "
        "Lead with the effect on their goals and timelines.",
    },
}


def voice(avatar: Avatar) -> str:
    return PERSONAS[avatar]["voice"]


def label(avatar: Avatar) -> str:
    return PERSONAS[avatar]["label"]
