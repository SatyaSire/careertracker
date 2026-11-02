# CareerTrack BI backend regression tests (auth, categories, applications, assessments, interviews,
# resumes, contacts/companies/reminders, activity, dashboard, analytics, preferences, export/restore)
import os
import uuid
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
def ctx():
    return {}


# --- Auth ---
def test_auth_me(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 200
    d = r.json()
    assert d["user_id"] == "user_test_satya"
    assert d["email"] == "satya.vishwa01@gmail.com"
    assert "_id" not in d


@pytest.mark.parametrize("path", ["/auth/me", "/applications", "/categories", "/dashboard/kpis", "/analytics", "/resumes", "/contacts"])
def test_unauth_401(path):
    assert requests.get(f"{API}{path}").status_code == 401


def test_invalid_token_401():
    assert requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


# --- Categories ---
def test_category_crud(s, ctx):
    r = s.post(f"{API}/categories", json={"name": "TEST_Cat", "color": "#ff0000"})
    assert r.status_code == 200
    c = r.json(); ctx["cat"] = c
    assert c["name"] == "TEST_Cat" and c["archived"] is False
    assert s.post(f"{API}/categories", json={"name": ""}).status_code == 400
    r = s.put(f"{API}/categories/{c['id']}", json={"name": "TEST_Cat2"})
    assert r.status_code == 200 and r.json()["name"] == "TEST_Cat2"
    cats = s.get(f"{API}/categories").json()
    assert any(x["id"] == c["id"] and x["name"] == "TEST_Cat2" and "application_count" in x for x in cats)


# --- Applications ---
def test_application_create_get(s, ctx):
    payload = {"company_name": "TEST_Acme", "job_title": "TEST_SDET", "category_id": ctx["cat"]["id"],
               "status": "Applied", "source": "LinkedIn", "application_date": "2026-01-10T00:00:00+00:00"}
    r = s.post(f"{API}/applications", json=payload)
    assert r.status_code == 200
    a = r.json(); ctx["app"] = a
    assert a["category_name"] == "TEST_Cat2"
    g = s.get(f"{API}/applications/{a['id']}").json()
    assert g["company_name"] == "TEST_Acme"
    assert len(g["history"]) == 1 and g["history"][0]["new_status"] == "Applied"
    # auto-created company
    assert any(c["name"] == "TEST_Acme" for c in s.get(f"{API}/companies").json())


def test_application_search_filter(s, ctx):
    d = s.get(f"{API}/applications", params={"search": "TEST_SDET"}).json()
    assert d["total"] >= 1 and all("TEST_SDET" in x["job_title"] for x in d["items"])
    d = s.get(f"{API}/applications", params={"status": "Applied", "category_id": ctx["cat"]["id"]}).json()
    assert any(x["id"] == ctx["app"]["id"] for x in d["items"])
    d = s.get(f"{API}/applications", params={"status": "Rejected", "category_id": ctx["cat"]["id"]}).json()
    assert d["total"] == 0


def test_application_search_regex_special_chars(s):
    # Unescaped regex -> invalid pattern should not 500
    r = s.get(f"{API}/applications", params={"search": "C++ ("})
    assert r.status_code == 200, f"search with special chars returned {r.status_code}"


def test_category_delete_in_use_blocked(s, ctx):
    r = s.delete(f"{API}/categories/{ctx['cat']['id']}")
    assert r.status_code == 400


def test_application_status_change(s, ctx):
    r = s.put(f"{API}/applications/{ctx['app']['id']}", json={"status": "Interview Scheduled", "status_note": "TEST"})
    assert r.status_code == 200 and r.json()["status"] == "Interview Scheduled"
    assert "status_note" not in r.json()
    g = s.get(f"{API}/applications/{ctx['app']['id']}").json()
    assert g["history"][0]["previous_status"] == "Applied"
    assert g["history"][0]["new_status"] == "Interview Scheduled"


def test_application_duplicate(s, ctx):
    r = s.post(f"{API}/applications/{ctx['app']['id']}/duplicate")
    assert r.status_code == 200
    d = r.json(); ctx["dup"] = d
    assert d["id"] != ctx["app"]["id"] and d["job_title"].endswith("(Copy)")
    assert s.get(f"{API}/applications/{d['id']}").status_code == 200


# --- Assessments / Interviews ---
def test_assessment_crud(s, ctx):
    r = s.post(f"{API}/assessments", json={"application_id": ctx["app"]["id"], "name": "TEST_Assess", "status": "Received"})
    assert r.status_code == 200
    a = r.json(); ctx["assess"] = a
    r = s.put(f"{API}/assessments/{a['id']}", json={"status": "Passed"})
    assert r.json()["status"] == "Passed"
    lst = s.get(f"{API}/assessments", params={"application_id": ctx["app"]["id"]}).json()
    assert any(x["id"] == a["id"] and x["status"] == "Passed" for x in lst)
    det = s.get(f"{API}/applications/{ctx['app']['id']}").json()
    assert any(x["id"] == a["id"] for x in det["assessments"])


def test_interview_crud(s, ctx):
    r = s.post(f"{API}/interviews", json={"application_id": ctx["app"]["id"], "round": "TEST_Tech",
                                          "company_name": "TEST_Acme", "interview_date": "2030-01-01T10:00:00+00:00"})
    assert r.status_code == 200
    i = r.json(); ctx["iv"] = i
    assert i["status"] == "Scheduled"
    r = s.put(f"{API}/interviews/{i['id']}", json={"result": "Good"})
    assert r.json()["result"] == "Good"
    det = s.get(f"{API}/applications/{ctx['app']['id']}").json()
    assert any(x["id"] == i["id"] for x in det["interviews"])


# --- Resumes ---
def test_resume_upload_download_delete(s, ctx):
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n" + uuid.uuid4().hex.encode()
    r = s.post(f"{API}/resumes", files={"file": ("test_resume.pdf", pdf, "application/pdf")},
               data={"name": "TEST_Resume", "version": "v1"}, timeout=120)
    assert r.status_code == 200, r.text
    res = r.json(); ctx["res"] = res
    assert res["original_filename"] == "test_resume.pdf"
    bad = s.post(f"{API}/resumes", files={"file": ("x.txt", b"hi", "text/plain")}, data={"name": "TEST_bad"})
    assert bad.status_code == 400
    # link resume to app -> usage_count
    s.put(f"{API}/applications/{ctx['app']['id']}", json={"resume_id": res["id"], "resume_name": "TEST_Resume"})
    lst = s.get(f"{API}/resumes").json()
    row = next(x for x in lst if x["id"] == res["id"])
    assert row["usage_count"] == 1
    dl = s.get(f"{API}/resumes/{res['id']}/download", timeout=60)
    assert dl.status_code == 200 and dl.content == pdf
    assert s.delete(f"{API}/resumes/{res['id']}").status_code == 200
    assert all(x["id"] != res["id"] for x in s.get(f"{API}/resumes").json())
    assert s.get(f"{API}/resumes/{res['id']}/download").status_code == 404


# --- Contacts / Companies / Reminders ---
@pytest.mark.parametrize("name,payload,upd", [
    ("contacts", {"name": "TEST_Contact", "email": "t@x.com"}, {"email": "t2@x.com"}),
    ("companies", {"name": "TEST_Co"}, {"industry": "Tech"}),
    ("reminders", {"title": "TEST_Rem", "due_date": "2020-01-01T00:00:00+00:00"}, {"priority": "High"}),
])
def test_simple_crud(s, name, payload, upd):
    r = s.post(f"{API}/{name}", json=payload)
    assert r.status_code == 200
    item = r.json()
    k, v = list(upd.items())[0]
    r = s.put(f"{API}/{name}/{item['id']}", json=upd)
    assert r.status_code == 200 and r.json()[k] == v
    assert any(x["id"] == item["id"] for x in s.get(f"{API}/{name}").json())
    if name == "reminders":
        assert item["status"] == "Pending"
        kp = s.get(f"{API}/dashboard/kpis").json()
        assert any(x["id"] == item["id"] for x in kp["attention"]["overdue_followups"])
    assert s.delete(f"{API}/{name}/{item['id']}").status_code == 200
    assert s.put(f"{API}/{name}/{item['id']}", json=upd).status_code == 404


# --- Activity / Dashboard / Analytics ---
def test_activity_logged(s, ctx):
    acts = s.get(f"{API}/activity").json()
    ids = {(a["action"], a["entity_id"]) for a in acts}
    assert ("created", ctx["app"]["id"]) in ids
    assert ("status_changed", ctx["app"]["id"]) in ids
    assert ("updated", ctx["assess"]["id"]) in ids


def test_dashboard_kpis(s, ctx):
    k = s.get(f"{API}/dashboard/kpis").json()
    assert k["total_applications"] >= 2
    assert k["upcoming_interviews"] >= 1
    assert any(x["id"] == ctx["iv"]["id"] for x in k["attention"]["scheduled_interviews"])


def test_analytics(s, ctx):
    a = s.get(f"{API}/analytics").json()
    for key in ("over_time_monthly", "over_time_weekly", "by_category", "funnel", "outcomes", "rates", "profile_performance"):
        assert key in a
    f = s.get(f"{API}/analytics", params={"category_id": ctx["cat"]["id"]}).json()
    assert f["total"] == 2
    assert f["rates"]["assessment_pass_pct"] == 100.0


def test_analytics_date_to_inclusive(s, ctx):
    # app dated 2026-01-10; date_to on same day should include it
    f = s.get(f"{API}/analytics", params={"category_id": ctx["cat"]["id"], "date_from": "2026-01-10", "date_to": "2026-01-10"}).json()
    assert f["total"] >= 1, "date_to is exclusive of the selected day"


def test_analytics_empty_filter_stats(s):
    f = s.get(f"{API}/analytics", params={"company": "NO_SUCH_COMPANY_ZZZ"}).json()
    assert f["total"] == 0
    assert sum(x["value"] for x in f["assessment_stats"]) == 0, "assessment stats leak all data when filter matches 0 apps"


# --- Preferences / Export / Restore ---
def test_preferences(s):
    r = s.put(f"{API}/preferences", json={"currency": "USD"})
    assert r.json()["currency"] == "USD"
    assert s.get(f"{API}/preferences").json()["currency"] == "USD"
    s.put(f"{API}/preferences", json={"currency": "INR"})


def test_exports(s):
    r = s.get(f"{API}/export/applications.csv")
    assert r.status_code == 200 and "company_name" in r.text.splitlines()[0] and "TEST_Acme" in r.text
    assert s.get(f"{API}/export/assessments.csv").status_code == 200
    assert s.get(f"{API}/export/interviews.csv").status_code == 200
    b = s.get(f"{API}/export/backup").json()
    assert "applications" in b["collections"]


def test_restore_merge(s):
    new_id = str(uuid.uuid4())
    r = s.post(f"{API}/restore", json={"mode": "merge", "collections": {
        "companies": [{"id": new_id, "name": "TEST_Restored"}]}})
    assert r.status_code == 200 and r.json()["inserted"]["companies"] == 1
    r = s.post(f"{API}/restore", json={"mode": "merge", "collections": {
        "companies": [{"id": new_id, "name": "TEST_Restored"}]}})
    assert r.json()["inserted"]["companies"] == 0
    s.delete(f"{API}/companies/{new_id}")


def test_restore_merge_preferences_no_dup(s):
    s.post(f"{API}/restore", json={"mode": "merge", "collections": {
        "user_preferences": [{"theme": "dark", "currency": "INR"}]}})
    b = s.get(f"{API}/export/backup").json()
    assert len(b["collections"]["user_preferences"]) <= 1, "merge restore duplicates user_preferences docs"


# --- Isolation & cleanup ---
def test_isolation_other_token(ctx):
    r = requests.get(f"{API}/applications/{ctx['app']['id']}", headers={"Authorization": "Bearer invalid_x"})
    assert r.status_code == 401


def test_cleanup(s, ctx):
    for k in ("dup", "app"):
        assert s.delete(f"{API}/applications/{ctx[k]['id']}").status_code == 200
        assert s.get(f"{API}/applications/{ctx[k]['id']}").status_code == 404
    assert s.get(f"{API}/assessments", params={"application_id": ctx["app"]["id"]}).json() == []
    assert s.delete(f"{API}/categories/{ctx['cat']['id']}").status_code == 200
    for c in s.get(f"{API}/companies").json():
        if c["name"].startswith("TEST_"):
            s.delete(f"{API}/companies/{c['id']}")
