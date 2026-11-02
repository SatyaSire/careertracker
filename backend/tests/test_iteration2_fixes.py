# Iteration 2 retests: create defaults, regex search, analytics empty/inclusive, restore prefs,
# duplicate history, assessment/interview app ownership validation, delete activity logs, interview status filter
import os
import uuid
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
TOKEN = "test_session_satya"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {TOKEN}"})
    return sess


@pytest.fixture(scope="module")
def ctx(s):
    c = {"apps": []}
    yield c
    for aid in c["apps"]:
        s.delete(f"{API}/applications/{aid}")
    for co in s.get(f"{API}/companies").json():
        if co["name"].startswith("TEST_"):
            s.delete(f"{API}/companies/{co['id']}")


def _mk(s, ctx, **kw):
    payload = {"company_name": "TEST_It2Co", "job_title": "TEST_It2"}
    payload.update(kw)
    r = s.post(f"{API}/applications", json=payload)
    assert r.status_code == 200, r.text
    ctx["apps"].append(r.json()["id"])
    return r.json()


# --- Create defaults ---
def test_create_empty_status_date_defaults(s, ctx):
    a = _mk(s, ctx, status="", application_date="")
    assert a["status"] == "Applied"
    assert a["application_date"][:10] == datetime.now(timezone.utc).strftime("%Y-%m-%d")
    g = s.get(f"{API}/applications/{a['id']}").json()
    assert g["status"] == "Applied" and g["history"][0]["new_status"] == "Applied"
    ctx["empty_app"] = a


def test_create_missing_status_defaults(s, ctx):
    a = _mk(s, ctx)
    assert a["status"] == "Applied" and a["application_date"]


def test_create_null_status_defaults(s, ctx):
    a = _mk(s, ctx, status=None, application_date=None)
    assert a["status"] == "Applied" and a["application_date"]


def test_update_empty_status_date_ignored(s, ctx):
    a = ctx["empty_app"]
    r = s.put(f"{API}/applications/{a['id']}", json={"status": "", "application_date": "", "notes": "x"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "Applied" and d["application_date"] == a["application_date"] and d["notes"] == "x"


def test_kpis_count_new_app(s, ctx):
    k = s.get(f"{API}/dashboard/kpis").json()
    assert k["active_applications"] >= 1
    assert k["applications_awaiting_response"] >= 1
    assert k["applications_this_month"] >= 1


def test_analytics_over_time_counts_new_app(s, ctx):
    a = s.get(f"{API}/analytics", params={"company": "TEST_It2Co"}).json()
    assert a["total"] == len(ctx["apps"])
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    assert any(x["label"] == month and x["value"] >= 1 for x in a["over_time_monthly"])


# --- Search regex ---
@pytest.mark.parametrize("q", ["C++ (", "[abc", "a.*b", "\\", "(?<"])
def test_search_special_chars(s, q):
    r = s.get(f"{API}/applications", params={"search": q})
    assert r.status_code == 200 and "items" in r.json()
    r = s.get(f"{API}/applications", params={"company": q})
    assert r.status_code == 200


def test_search_literal_match(s, ctx):
    a = _mk(s, ctx, company_name="TEST_C++ (Co)", job_title="TEST_Lit")
    d = s.get(f"{API}/applications", params={"search": "C++ (Co"}).json()
    assert any(x["id"] == a["id"] for x in d["items"])


# --- Analytics ---
def test_analytics_zero_match_all_zero(s):
    f = s.get(f"{API}/analytics", params={"company": "NO_SUCH_COMPANY_ZZZ"}).json()
    assert f["total"] == 0
    assert sum(x["value"] for x in f["assessment_stats"]) == 0
    assert sum(x["value"] for x in f["interview_stats"]) == 0


def test_analytics_date_to_inclusive(s, ctx):
    a = _mk(s, ctx, company_name="TEST_DateCo", application_date="2025-06-15T18:30:00+00:00")
    f = s.get(f"{API}/analytics", params={"company": "TEST_DateCo", "date_from": "2025-06-15", "date_to": "2025-06-15"}).json()
    assert f["total"] == 1
    f = s.get(f"{API}/analytics", params={"company": "TEST_DateCo", "date_to": "2025-06-14"}).json()
    assert f["total"] == 0


# --- Restore prefs ---
def test_restore_merge_prefs_no_dup(s):
    for _ in range(2):
        r = s.post(f"{API}/restore", json={"mode": "merge", "collections": {
            "user_preferences": [{"theme": "dark", "currency": "INR"}]}})
        assert r.status_code == 200
    b = s.get(f"{API}/export/backup").json()
    assert len(b["collections"]["user_preferences"]) == 1


# --- Duplicate ---
def test_duplicate_history_and_date(s, ctx):
    src = _mk(s, ctx, application_date="2024-01-01T00:00:00+00:00", status="Rejected")
    r = s.post(f"{API}/applications/{src['id']}/duplicate")
    assert r.status_code == 200
    d = r.json(); ctx["apps"].append(d["id"])
    assert d["application_date"][:10] == datetime.now(timezone.utc).strftime("%Y-%m-%d")
    g = s.get(f"{API}/applications/{d['id']}").json()
    assert len(g["history"]) == 1 and g["history"][0]["new_status"] == d["status"]


# --- Ownership validation ---
@pytest.mark.parametrize("ep", ["assessments", "interviews"])
def test_create_with_bad_app_id_400(s, ep):
    r = s.post(f"{API}/{ep}", json={"application_id": f"nonexistent-{uuid.uuid4()}", "name": "TEST_x", "round": "TEST_x"})
    assert r.status_code == 400


@pytest.mark.parametrize("ep", ["assessments", "interviews"])
def test_create_without_app_id_ok_and_delete_logs(s, ep):
    r = s.post(f"{API}/{ep}", json={"name": "TEST_x", "round": "TEST_x"})
    assert r.status_code == 200
    iid = r.json()["id"]
    assert s.delete(f"{API}/{ep}/{iid}").status_code == 200
    acts = s.get(f"{API}/activity").json()
    assert any(a["action"] == "deleted" and a["entity_id"] == iid for a in acts)


def test_other_user_app_id_400(s):
    # Insert app owned by another user via restore is impossible (restore forces uid); use mongo directly
    from pymongo import MongoClient
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
    oid = f"TEST_other_{uuid.uuid4()}"
    db.applications.insert_one({"id": oid, "user_id": "user_TEST_other", "company_name": "TEST_Other"})
    try:
        for ep in ("assessments", "interviews"):
            r = s.post(f"{API}/{ep}", json={"application_id": oid, "name": "TEST_x"})
            assert r.status_code == 400, f"{ep} -> {r.status_code}"
    finally:
        db.applications.delete_one({"id": oid})


# --- Interview status filter ---
def test_interview_status_filter(s, ctx):
    a = _mk(s, ctx, company_name="TEST_IvCo")
    i1 = s.post(f"{API}/interviews", json={"application_id": a["id"], "round": "TEST_R1", "status": "Completed"}).json()
    i2 = s.post(f"{API}/interviews", json={"application_id": a["id"], "round": "TEST_R2"}).json()
    lst = s.get(f"{API}/interviews", params={"status": "Completed"}).json()
    ids = {x["id"] for x in lst}
    assert i1["id"] in ids and i2["id"] not in ids
    assert all(x["status"] == "Completed" for x in lst)
