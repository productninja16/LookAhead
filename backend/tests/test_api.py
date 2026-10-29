import os

import pytest
from fastapi.testclient import TestClient

os.environ.pop("ANTHROPIC_API_KEY", None)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from app import limits, store

    monkeypatch.setattr(store, "DB_PATH", str(tmp_path / "t.db"))
    limits.reset()
    from app.main import app

    with TestClient(app) as c:
        yield c


def test_state_requires_profile(client):
    assert client.get("/api/state").status_code == 404


def test_demo_then_state(client):
    r = client.post("/api/demo/maya")
    assert r.status_code == 200
    state = client.get("/api/state").json()
    assert state["profile"]["name"] == "Maya"
    assert state["snapshot"]["safe_to_spend"] > 0
    assert state["llm"]["available"] is False


def test_purchase_check_returns_grounded_verdict_offline(client):
    client.post("/api/demo/dev")
    r = client.post("/api/chat", json={"message": "Can I afford a $549 pair of headphones?"}).json()
    assert r["intent"] == "purchase_check"
    v = r["messages"][0]
    assert v["type"] == "verdict" and v["source"] == "fallback"
    assert v["grounding"]["references_user_numbers"] is True
    assert v["facts"]["amount"] == 549


def test_tool_flow_confirm_updates_profile(client):
    client.post("/api/demo/maya")
    before = client.get("/api/state").json()["profile"]["checking_balance"]
    r = client.post("/api/chat", json={"message": "I got a bonus of $1,000 this month."}).json()
    card = r["messages"][0]
    assert card["type"] == "tool_confirmation"
    assert card["impact"]["safe_to_spend_after"] > card["impact"]["safe_to_spend_before"]
    after = client.post("/api/tools/confirm", json={"proposal": card["proposal"], "confirm": True}).json()
    assert after["profile"]["checking_balance"] == before + 1000


def test_decline_tool_changes_nothing(client):
    client.post("/api/demo/maya")
    before = client.get("/api/state").json()["profile"]
    card = client.post("/api/chat", json={"message": "I paid my rent today."}).json()["messages"][0]
    after = client.post("/api/tools/confirm", json={"proposal": card["proposal"], "confirm": False}).json()
    assert after["profile"]["checking_balance"] == before["checking_balance"]


def test_confirm_rejects_unknown_obligation(client):
    client.post("/api/demo/maya")
    bad = {"action": "mark_paid", "params": {"obligation_id": "nope", "amount": 5}, "summary": ""}
    assert client.post("/api/tools/confirm", json={"proposal": bad, "confirm": True}).status_code == 400


def test_decision_lifecycle_and_followup(client):
    client.post("/api/demo/sam")  # seeds a 9-day-old waiting decision
    ds = client.get("/api/decisions").json()
    assert ds[0]["followup_due"] is True
    assert client.patch(f"/api/decisions/{ds[0]['id']}", json={"status": "skipped", "regret": "good_call"}).status_code == 200
    assert client.get("/api/decisions").json()[0]["status"] == "skipped"


def test_sessions_are_isolated(client):
    client.post("/api/demo/maya")
    other = TestClient(client.app)
    assert other.get("/api/state").status_code == 404


def test_out_of_scope_is_declined(client):
    client.post("/api/demo/maya")
    r = client.post("/api/chat", json={"message": "Should I put money in a Roth IRA?"}).json()
    assert "investment" in r["messages"][0]["text"].lower()


def test_session_cap_forces_fallback(client, monkeypatch):
    from app import limits

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    monkeypatch.setattr(limits, "SESSION_CAP", 0)
    client.post("/api/demo/maya")
    r = client.post("/api/chat", json={"message": "Can I afford a $100 dinner?"}).json()
    assert r["llm"]["used"] is False and r["llm"]["reason"] == "session_cap"
