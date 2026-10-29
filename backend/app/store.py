"""SQLite persistence: profiles, conversations, saved_decisions, keyed by anonymous session."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from .core.models import Profile

DB_PATH = os.getenv("LOOKAHEAD_DB", str(Path(__file__).resolve().parent.parent / "data" / "lookahead.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
  session_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated REAL NOT NULL);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL,
  content TEXT NOT NULL, payload TEXT, created REAL NOT NULL);
CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id, id);
CREATE TABLE IF NOT EXISTS saved_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, item TEXT NOT NULL,
  amount REAL NOT NULL, verdict TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting',
  regret TEXT, created REAL NOT NULL);
CREATE INDEX IF NOT EXISTS idx_dec_session ON saved_decisions(session_id);
"""


@contextmanager
def _db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init() -> None:
    with _db() as con:
        con.executescript(SCHEMA)


def get_profile(sid: str) -> Profile | None:
    with _db() as con:
        row = con.execute("SELECT data FROM profiles WHERE session_id=?", (sid,)).fetchone()
    return Profile.model_validate_json(row["data"]) if row else None


def save_profile(sid: str, profile: Profile) -> None:
    with _db() as con:
        con.execute(
            "INSERT INTO profiles(session_id, data, updated) VALUES(?,?,?) "
            "ON CONFLICT(session_id) DO UPDATE SET data=excluded.data, updated=excluded.updated",
            (sid, profile.model_dump_json(), time.time()),
        )


def add_message(sid: str, role: str, content: str, payload: dict | None = None) -> None:
    with _db() as con:
        con.execute(
            "INSERT INTO conversations(session_id, role, content, payload, created) VALUES(?,?,?,?,?)",
            (sid, role, content, json.dumps(payload) if payload else None, time.time()),
        )


def get_messages(sid: str, limit: int = 60) -> list[dict]:
    with _db() as con:
        rows = con.execute(
            "SELECT role, content, payload FROM conversations WHERE session_id=? ORDER BY id DESC LIMIT ?",
            (sid, limit),
        ).fetchall()
    return [
        {"role": r["role"], "content": r["content"], "payload": json.loads(r["payload"]) if r["payload"] else None}
        for r in reversed(rows)
    ]


def save_decision(sid: str, item: str, amount: float, verdict: str, created: float | None = None) -> int:
    with _db() as con:
        cur = con.execute(
            "INSERT INTO saved_decisions(session_id, item, amount, verdict, created) VALUES(?,?,?,?,?)",
            (sid, item, amount, verdict, created or time.time()),
        )
        return cur.lastrowid


def list_decisions(sid: str) -> list[dict]:
    with _db() as con:
        rows = con.execute(
            "SELECT * FROM saved_decisions WHERE session_id=? ORDER BY id DESC", (sid,)
        ).fetchall()
    return [dict(r) for r in rows]


def update_decision(sid: str, decision_id: int, status: str, regret: str | None) -> bool:
    with _db() as con:
        cur = con.execute(
            "UPDATE saved_decisions SET status=?, regret=? WHERE id=? AND session_id=?",
            (status, regret, decision_id, sid),
        )
        return cur.rowcount > 0


def delete_session(sid: str) -> None:
    with _db() as con:
        for table in ("profiles", "conversations", "saved_decisions"):
            con.execute(f"DELETE FROM {table} WHERE session_id=?", (sid,))


def purge_older_than(days: int = 7) -> None:
    cutoff = time.time() - days * 86400
    with _db() as con:
        old = [r["session_id"] for r in con.execute("SELECT session_id FROM profiles WHERE updated<?", (cutoff,))]
        for sid in old:
            for table in ("profiles", "conversations", "saved_decisions"):
                con.execute(f"DELETE FROM {table} WHERE session_id=?", (sid,))
