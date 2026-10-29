"""Cost protection for a public demo: per-session and global daily caps on LLM-backed questions.

When a cap is hit the app keeps working on the deterministic fallback and tells the user.
"""

from __future__ import annotations

import os
import threading
from collections import defaultdict
from datetime import date

SESSION_CAP = int(os.getenv("LOOKAHEAD_SESSION_CAP", "15"))
DAILY_CAP = int(os.getenv("LOOKAHEAD_DAILY_CAP", "300"))

_lock = threading.Lock()
_session: dict[str, int] = defaultdict(int)
_daily: dict[date, int] = defaultdict(int)


def check(sid: str) -> tuple[bool, str | None]:
    with _lock:
        if _daily[date.today()] >= DAILY_CAP:
            return False, "daily_cap"
        if _session[sid] >= SESSION_CAP:
            return False, "session_cap"
    return True, None


def record(sid: str) -> None:
    with _lock:
        _session[sid] += 1
        _daily[date.today()] += 1


def remaining(sid: str) -> int:
    with _lock:
        return max(0, SESSION_CAP - _session[sid])


def reset() -> None:
    with _lock:
        _session.clear()
        _daily.clear()
