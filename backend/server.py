"""CareerTrack BI - FastAPI backend.
Single-user personal ATS + BI. All data scoped by user_id (ownership enforcement).
"""
import os
import io
import csv
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, Query, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

OWNER_EMAIL = os.environ.get('OWNER_EMAIL', '').strip().lower()

# ---- Object storage ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "careertrack-bi"
_storage_key = None

def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

app = FastAPI(title="CareerTrack BI")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================= AUTH =============================
async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class SessionExchange(BaseModel):
    session_id: str


@api_router.post("/auth/session")
async def auth_session(payload: SessionExchange, response: Response):
    r = requests.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                     headers={"X-Session-ID": payload.session_id}, timeout=30)
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session id")
    data = r.json()
    email = (data.get("email") or "").strip().lower()
    # Single-user gating: only the owner email may sign in
    if OWNER_EMAIL and email != OWNER_EMAIL:
        raise HTTPException(status_code=403, detail="This is a private workspace. Access restricted to the owner.")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "created_at": now_iso(),
        })
        await seed_defaults(user_id)
    session_token = data.get("session_token") or f"st_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at.isoformat(), "created_at": now_iso(),
    })
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", path="/", max_age=7 * 24 * 60 * 60)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============================= HELPERS =============================
async def log_activity(user_id: str, action: str, entity: str, entity_id: str, summary: str,
                       application_id: Optional[str] = None):
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "action": action, "entity": entity,
        "entity_id": entity_id, "application_id": application_id, "summary": summary,
        "created_at": now_iso(),
    })


DEFAULT_CATEGORIES = [
    ("Software Engineering", "#6366f1"), ("Frontend Development", "#3b82f6"),
    ("Backend Development", "#8b5cf6"), ("Full Stack Development", "#06b6d4"),
    ("QA & Testing", "#10b981"), ("QA Automation / SDET", "#14b8a6"),
    ("AI & Machine Learning", "#f59e0b"), ("AI Trainer / AI Evaluator", "#f97316"),
    ("Data Analyst", "#ec4899"), ("Business Analyst", "#a855f7"),
    ("Customer Support", "#84cc16"), ("FinCrime / KYC / AML", "#ef4444"),
    ("Project Management", "#0ea5e9"), ("Other", "#64748b"),
]


async def seed_defaults(user_id: str):
    cats = [{
        "id": str(uuid.uuid4()), "user_id": user_id, "name": n, "color": c,
        "archived": False, "created_at": now_iso(),
    } for n, c in DEFAULT_CATEGORIES]
    if cats:
        await db.job_categories.insert_many(cats)
    await db.user_preferences.insert_one({
        "user_id": user_id, "theme": "dark", "currency": "INR", "saved_filters": [],
        "created_at": now_iso(),
    })


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# Generic CRUD factory for simple owned collections
def register_crud(name: str, coll: str, entity_label: str, extra_defaults=None):
    @api_router.get(f"/{name}")
    async def list_items(user: dict = Depends(get_current_user)):
        items = await db[coll].find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(5000)
        return items

    @api_router.post(f"/{name}")
    async def create_item(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        doc = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id")}
        doc["id"] = str(uuid.uuid4())
        doc["user_id"] = user["user_id"]
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        if extra_defaults:
            for k, v in extra_defaults.items():
                doc.setdefault(k, v)
        await db[coll].insert_one(doc)
        await log_activity(user["user_id"], "created", entity_label, doc["id"],
                           f"{entity_label} created")
        return clean(await db[coll].find_one({"id": doc["id"]}, {"_id": 0}))

    @api_router.put(f"/{name}/{{item_id}}")
    async def update_item(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        existing = await db[coll].find_one({"id": item_id, "user_id": user["user_id"]}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Not found")
        updates = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id", "created_at")}
        updates["updated_at"] = now_iso()
        await db[coll].update_one({"id": item_id, "user_id": user["user_id"]}, {"$set": updates})
        await log_activity(user["user_id"], "updated", entity_label, item_id, f"{entity_label} updated")
        return clean(await db[coll].find_one({"id": item_id}, {"_id": 0}))

    @api_router.delete(f"/{name}/{{item_id}}")
    async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
        res = await db[coll].delete_one({"id": item_id, "user_id": user["user_id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        await log_activity(user["user_id"], "deleted", entity_label, item_id, f"{entity_label} deleted")
        return {"ok": True}

    list_items.__name__ = f"list_{name}"
    create_item.__name__ = f"create_{name}"
    update_item.__name__ = f"update_{name}"
    delete_item.__name__ = f"delete_{name}"


# ============================= CATEGORIES =============================
@api_router.get("/categories")
async def list_categories(include_archived: bool = True, user: dict = Depends(get_current_user)):
    q = {"user_id": user["user_id"]}
    if not include_archived:
        q["archived"] = False
    cats = await db.job_categories.find(q, {"_id": 0}).sort("name", 1).to_list(1000)
    # attach counts
    apps = await db.applications.find({"user_id": user["user_id"]}, {"_id": 0, "category_id": 1}).to_list(10000)
    counts: Dict[str, int] = {}
    for a in apps:
        cid = a.get("category_id")
        if cid:
            counts[cid] = counts.get(cid, 0) + 1
    for c in cats:
        c["application_count"] = counts.get(c["id"], 0)
    return cats


@api_router.post("/categories")
async def create_category(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["user_id"],
        "name": (payload.get("name") or "").strip(),
        "color": payload.get("color") or "#6366f1",
        "archived": False, "created_at": now_iso(),
    }
    if not doc["name"]:
        raise HTTPException(status_code=400, detail="Category name required")
    await db.job_categories.insert_one(doc)
    await log_activity(user["user_id"], "created", "Category", doc["id"], f"Category '{doc['name']}' created")
    return clean(await db.job_categories.find_one({"id": doc["id"]}, {"_id": 0}))


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    existing = await db.job_categories.find_one({"id": cat_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: payload[k] for k in ("name", "color", "archived") if k in payload}
    await db.job_categories.update_one({"id": cat_id, "user_id": user["user_id"]}, {"$set": updates})
    return clean(await db.job_categories.find_one({"id": cat_id}, {"_id": 0}))


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(get_current_user)):
    in_use = await db.applications.count_documents({"user_id": user["user_id"], "category_id": cat_id})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"Category in use by {in_use} application(s). Archive it instead.")
    res = await db.job_categories.delete_one({"id": cat_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ============================= COMPANIES & CONTACTS =============================
register_crud("companies", "companies", "Company")
register_crud("contacts", "contact_profiles", "Contact Profile", {"active": True})
register_crud("reminders", "reminders", "Reminder", {"status": "Pending", "priority": "Medium"})


# ============================= APPLICATIONS =============================
@api_router.get("/applications")
async def list_applications(
    search: Optional[str] = None, category_id: Optional[str] = None,
    status: Optional[str] = None, company: Optional[str] = None,
    work_arrangement: Optional[str] = None, source: Optional[str] = None,
    sort: str = "newest", page: int = 1, page_size: int = 20,
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {"user_id": user["user_id"]}
    if category_id:
        q["category_id"] = category_id
    if status:
        q["status"] = status
    if work_arrangement:
        q["work_arrangement"] = work_arrangement
    if source:
        q["source"] = source
    if company:
        q["company_name"] = {"$regex": company, "$options": "i"}
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [
            {"company_name": rx}, {"job_title": rx}, {"job_description": rx},
            {"category_name": rx}, {"email_used": rx}, {"phone_used": rx},
            {"resume_name": rx}, {"recruiter_name": rx}, {"notes": rx},
        ]
    sort_map = {
        "newest": [("application_date", -1), ("created_at", -1)],
        "oldest": [("application_date", 1), ("created_at", 1)],
        "company": [("company_name", 1)],
        "status": [("status", 1)],
    }
    sort_spec = sort_map.get(sort, sort_map["newest"])
    total = await db.applications.count_documents(q)
    page = max(1, page)
    cursor = db.applications.find(q, {"_id": 0}).sort(sort_spec).skip((page - 1) * page_size).limit(page_size)
    items = await cursor.to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@api_router.get("/applications/{app_id}")
async def get_application(app_id: str, user: dict = Depends(get_current_user)):
    doc = await db.applications.find_one({"id": app_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    doc["assessments"] = await db.assessments.find({"application_id": app_id, "user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["interviews"] = await db.interviews.find({"application_id": app_id, "user_id": user["user_id"]}, {"_id": 0}).sort("interview_date", 1).to_list(500)
    doc["history"] = await db.application_status_history.find({"application_id": app_id, "user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    doc["timeline"] = await db.activity_logs.find({"application_id": app_id, "user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return doc


async def _enrich_category_name(user_id: str, doc: dict):
    if doc.get("category_id"):
        cat = await db.job_categories.find_one({"id": doc["category_id"], "user_id": user_id}, {"_id": 0})
        doc["category_name"] = cat["name"] if cat else None
        doc["category_color"] = cat["color"] if cat else None


@api_router.post("/applications")
async def create_application(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id")}
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["user_id"]
    doc.setdefault("status", "Applied")
    doc.setdefault("application_date", now_iso())
    doc.setdefault("tags", [])
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await _enrich_category_name(user["user_id"], doc)
    await db.applications.insert_one(doc)
    await db.application_status_history.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["user_id"], "application_id": doc["id"],
        "previous_status": None, "new_status": doc["status"], "notes": "Application created",
        "created_at": now_iso(),
    })
    await log_activity(user["user_id"], "created", "Application", doc["id"],
                       f"Applied to {doc.get('job_title','role')} at {doc.get('company_name','company')}",
                       application_id=doc["id"])
    # auto-create company if new
    cname = (doc.get("company_name") or "").strip()
    if cname:
        exists = await db.companies.find_one({"user_id": user["user_id"], "name": cname}, {"_id": 0})
        if not exists:
            await db.companies.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["user_id"], "name": cname,
                "website": doc.get("company_website"), "industry": doc.get("industry"),
                "location": doc.get("company_location"), "linkedin": doc.get("company_linkedin"),
                "notes": doc.get("company_notes"), "created_at": now_iso(), "updated_at": now_iso(),
            })
    return clean(await db.applications.find_one({"id": doc["id"]}, {"_id": 0}))


@api_router.put("/applications/{app_id}")
async def update_application(app_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    existing = await db.applications.find_one({"id": app_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id", "created_at")}
    updates["updated_at"] = now_iso()
    new_status = updates.get("status")
    if new_status and new_status != existing.get("status"):
        await db.application_status_history.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["user_id"], "application_id": app_id,
            "previous_status": existing.get("status"), "new_status": new_status,
            "notes": payload.get("status_note") or "", "created_at": now_iso(),
        })
        await log_activity(user["user_id"], "status_changed", "Application", app_id,
                           f"Status: {existing.get('status')} → {new_status}", application_id=app_id)
    updates.pop("status_note", None)
    if "category_id" in updates:
        await _enrich_category_name(user["user_id"], updates)
    await db.applications.update_one({"id": app_id, "user_id": user["user_id"]}, {"$set": updates})
    await log_activity(user["user_id"], "updated", "Application", app_id, "Application updated", application_id=app_id)
    return clean(await db.applications.find_one({"id": app_id}, {"_id": 0}))


@api_router.delete("/applications/{app_id}")
async def delete_application(app_id: str, user: dict = Depends(get_current_user)):
    res = await db.applications.delete_one({"id": app_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await db.assessments.delete_many({"application_id": app_id, "user_id": user["user_id"]})
    await db.interviews.delete_many({"application_id": app_id, "user_id": user["user_id"]})
    await db.application_status_history.delete_many({"application_id": app_id, "user_id": user["user_id"]})
    await log_activity(user["user_id"], "deleted", "Application", app_id, "Application deleted")
    return {"ok": True}


@api_router.post("/applications/{app_id}/duplicate")
async def duplicate_application(app_id: str, user: dict = Depends(get_current_user)):
    src = await db.applications.find_one({"id": app_id, "user_id": user["user_id"]}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Not found")
    dup = dict(src)
    dup["id"] = str(uuid.uuid4())
    dup["job_title"] = f"{src.get('job_title','')} (Copy)"
    dup["status"] = "Saved / Interested"
    dup["created_at"] = now_iso()
    dup["updated_at"] = now_iso()
    await db.applications.insert_one(dup)
    await log_activity(user["user_id"], "created", "Application", dup["id"], "Application duplicated", application_id=dup["id"])
    return clean(await db.applications.find_one({"id": dup["id"]}, {"_id": 0}))


# ============================= ASSESSMENTS =============================
@api_router.get("/assessments")
async def list_assessments(application_id: Optional[str] = None, status: Optional[str] = None,
                           user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {"user_id": user["user_id"]}
    if application_id:
        q["application_id"] = application_id
    if status:
        q["status"] = status
    return await db.assessments.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api_router.post("/assessments")
async def create_assessment(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id")}
    doc.update({"id": str(uuid.uuid4()), "user_id": user["user_id"],
                "created_at": now_iso(), "updated_at": now_iso()})
    doc.setdefault("status", "Received")
    await db.assessments.insert_one(doc)
    await log_activity(user["user_id"], "created", "Assessment", doc["id"],
                       f"Assessment '{doc.get('name','')}' added", application_id=doc.get("application_id"))
    return clean(await db.assessments.find_one({"id": doc["id"]}, {"_id": 0}))


@api_router.put("/assessments/{a_id}")
async def update_assessment(a_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    existing = await db.assessments.find_one({"id": a_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id", "created_at")}
    updates["updated_at"] = now_iso()
    await db.assessments.update_one({"id": a_id, "user_id": user["user_id"]}, {"$set": updates})
    await log_activity(user["user_id"], "updated", "Assessment", a_id, "Assessment updated",
                       application_id=existing.get("application_id"))
    return clean(await db.assessments.find_one({"id": a_id}, {"_id": 0}))


@api_router.delete("/assessments/{a_id}")
async def delete_assessment(a_id: str, user: dict = Depends(get_current_user)):
    res = await db.assessments.delete_one({"id": a_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ============================= INTERVIEWS =============================
@api_router.get("/interviews")
async def list_interviews(application_id: Optional[str] = None, status: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {"user_id": user["user_id"]}
    if application_id:
        q["application_id"] = application_id
    if status:
        q["status"] = status
    return await db.interviews.find(q, {"_id": 0}).sort("interview_date", 1).to_list(5000)


@api_router.post("/interviews")
async def create_interview(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    doc = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id")}
    doc.update({"id": str(uuid.uuid4()), "user_id": user["user_id"],
                "created_at": now_iso(), "updated_at": now_iso()})
    doc.setdefault("status", "Scheduled")
    await db.interviews.insert_one(doc)
    await log_activity(user["user_id"], "created", "Interview", doc["id"],
                       f"Interview scheduled: {doc.get('round','')}", application_id=doc.get("application_id"))
    return clean(await db.interviews.find_one({"id": doc["id"]}, {"_id": 0}))


@api_router.put("/interviews/{i_id}")
async def update_interview(i_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    existing = await db.interviews.find_one({"id": i_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: v for k, v in payload.items() if k not in ("id", "user_id", "_id", "created_at")}
    updates["updated_at"] = now_iso()
    await db.interviews.update_one({"id": i_id, "user_id": user["user_id"]}, {"$set": updates})
    await log_activity(user["user_id"], "updated", "Interview", i_id, "Interview updated",
                       application_id=existing.get("application_id"))
    return clean(await db.interviews.find_one({"id": i_id}, {"_id": 0}))


@api_router.delete("/interviews/{i_id}")
async def delete_interview(i_id: str, user: dict = Depends(get_current_user)):
    res = await db.interviews.delete_one({"id": i_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ============================= RESUMES =============================
@api_router.get("/resumes")
async def list_resumes(user: dict = Depends(get_current_user)):
    resumes = await db.resumes.find({"user_id": user["user_id"], "is_deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for r in resumes:
        r["usage_count"] = await db.applications.count_documents({"user_id": user["user_id"], "resume_id": r["id"]})
    return resumes


@api_router.post("/resumes")
async def upload_resume(
    file: UploadFile = File(...), name: str = Form(...), target_profile: str = Form(""),
    version: str = Form(""), description: str = Form(""), skills: str = Form(""), notes: str = Form(""),
    user: dict = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    if ext not in ("pdf", "docx", "doc"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    path = f"{APP_NAME}/resumes/{user['user_id']}/{uuid.uuid4()}.{ext}"
    ct = file.content_type or ("application/pdf" if ext == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    result = put_object(path, data, ct)
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["user_id"], "name": name,
        "storage_path": result["path"], "original_filename": file.filename, "content_type": ct,
        "size": result.get("size", len(data)), "target_profile": target_profile, "version": version,
        "description": description, "skills": skills, "notes": notes, "is_deleted": False,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.resumes.insert_one(doc)
    await log_activity(user["user_id"], "created", "Resume", doc["id"], f"Resume '{name}' uploaded")
    return clean(await db.resumes.find_one({"id": doc["id"]}, {"_id": 0}))


@api_router.put("/resumes/{r_id}")
async def update_resume(r_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    existing = await db.resumes.find_one({"id": r_id, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: payload[k] for k in ("name", "target_profile", "version", "description", "skills", "notes") if k in payload}
    updates["updated_at"] = now_iso()
    await db.resumes.update_one({"id": r_id, "user_id": user["user_id"]}, {"$set": updates})
    return clean(await db.resumes.find_one({"id": r_id}, {"_id": 0}))


@api_router.delete("/resumes/{r_id}")
async def delete_resume(r_id: str, user: dict = Depends(get_current_user)):
    res = await db.resumes.update_one({"id": r_id, "user_id": user["user_id"]}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@api_router.get("/resumes/{r_id}/download")
async def download_resume(r_id: str, authorization: Optional[str] = Header(None),
                          auth: Optional[str] = Query(None), request: Request = None):
    token = (request.cookies.get("session_token") if request else None) or \
            (authorization.split(" ", 1)[1] if authorization and authorization.startswith("Bearer ") else None) or auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    record = await db.resumes.find_one({"id": r_id, "user_id": session["user_id"], "is_deleted": {"$ne": True}}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    content, ct = get_object(record["storage_path"])
    return Response(content=content, media_type=record.get("content_type", ct),
                    headers={"Content-Disposition": f'inline; filename="{record["original_filename"]}"'})


# ============================= PREFERENCES =============================
@api_router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    pref = await db.user_preferences.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not pref:
        pref = {"user_id": user["user_id"], "theme": "dark", "currency": "INR", "saved_filters": []}
        await db.user_preferences.insert_one(dict(pref))
    return pref


@api_router.put("/preferences")
async def update_preferences(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.items() if k in ("theme", "currency", "saved_filters")}
    await db.user_preferences.update_one({"user_id": user["user_id"]}, {"$set": updates}, upsert=True)
    return clean(await db.user_preferences.find_one({"user_id": user["user_id"]}, {"_id": 0}))


# ============================= ACTIVITY =============================
@api_router.get("/activity")
async def list_activity(limit: int = 200, user: dict = Depends(get_current_user)):
    return await db.activity_logs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


# ============================= DASHBOARD =============================
ACTIVE_STATUSES = {"Applied", "Application Acknowledged", "Recruiter Contacted", "Assessment Received",
                   "Assessment Pending", "Assessment Completed", "Assessment Passed", "Interview Scheduled",
                   "Interview Completed", "Awaiting Interview Feedback", "Technical Round", "HR Round",
                   "Managerial Round", "Final Round", "Offer Received"}


@api_router.get("/dashboard/kpis")
async def dashboard_kpis(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    apps = await db.applications.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    assessments = await db.assessments.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    interviews = await db.interviews.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    reminders = await db.reminders.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def parse(d):
        try:
            dt = datetime.fromisoformat(str(d).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    this_month = sum(1 for a in apps if (p := parse(a.get("application_date"))) and p >= month_start)
    active = sum(1 for a in apps if a.get("status") in ACTIVE_STATUSES)
    offers = sum(1 for a in apps if a.get("status") in ("Offer Received", "Offer Accepted", "Joined"))
    rejected = sum(1 for a in apps if a.get("status") == "Rejected")
    awaiting = sum(1 for a in apps if a.get("status") in ("Applied", "No Response", "Application Acknowledged"))

    a_pending = sum(1 for a in assessments if a.get("status") in ("Received", "Not Started", "In Progress", "Pending"))
    a_completed = sum(1 for a in assessments if a.get("status") in ("Completed", "Submitted", "Passed", "Failed"))

    upcoming_iv = 0
    completed_iv = 0
    for iv in interviews:
        if iv.get("status") in ("Completed", "Passed", "Failed"):
            completed_iv += 1
        elif iv.get("status") in ("Scheduled", "Rescheduled"):
            d = parse(iv.get("interview_date"))
            if d and d >= now:
                upcoming_iv += 1

    followups_due = 0
    for r in reminders:
        if r.get("status") == "Pending":
            d = parse(r.get("due_date"))
            if d and d <= now + timedelta(days=3):
                followups_due += 1

    # Attention required
    attention = {"overdue_assessments": [], "due_soon_assessments": [], "scheduled_interviews": [],
                 "overdue_followups": [], "stale_applications": []}
    for a in assessments:
        if a.get("status") in ("Completed", "Submitted", "Passed", "Failed", "Expired", "Cancelled"):
            continue
        d = parse(a.get("deadline"))
        if d:
            if d < now:
                attention["overdue_assessments"].append({"id": a["id"], "name": a.get("name"), "deadline": a.get("deadline"), "application_id": a.get("application_id")})
            elif d <= now + timedelta(days=3):
                attention["due_soon_assessments"].append({"id": a["id"], "name": a.get("name"), "deadline": a.get("deadline"), "application_id": a.get("application_id")})
    for iv in interviews:
        if iv.get("status") in ("Scheduled", "Rescheduled"):
            d = parse(iv.get("interview_date"))
            if d and d >= now:
                attention["scheduled_interviews"].append({"id": iv["id"], "round": iv.get("round"), "company": iv.get("company_name"), "interview_date": iv.get("interview_date"), "application_id": iv.get("application_id")})
    for r in reminders:
        if r.get("status") == "Pending":
            d = parse(r.get("due_date"))
            if d and d < now:
                attention["overdue_followups"].append({"id": r["id"], "title": r.get("title"), "due_date": r.get("due_date")})
    for a in apps:
        if a.get("status") in ("Applied", "No Response"):
            d = parse(a.get("updated_at")) or parse(a.get("created_at"))
            if d and d < now - timedelta(days=14):
                attention["stale_applications"].append({"id": a["id"], "company": a.get("company_name"), "job_title": a.get("job_title")})

    return {
        "total_applications": len(apps), "applications_this_month": this_month, "active_applications": active,
        "assessments_received": len(assessments), "assessments_pending": a_pending, "assessments_completed": a_completed,
        "upcoming_interviews": upcoming_iv, "interviews_completed": completed_iv,
        "offers_received": offers, "applications_rejected": rejected, "applications_awaiting_response": awaiting,
        "followups_due": followups_due, "attention": attention,
    }


# ============================= ANALYTICS =============================
@api_router.get("/analytics")
async def analytics(date_from: Optional[str] = None, date_to: Optional[str] = None,
                    category_id: Optional[str] = None, company: Optional[str] = None,
                    status: Optional[str] = None, source: Optional[str] = None,
                    user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    apps = await db.applications.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    assessments = await db.assessments.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    interviews = await db.interviews.find({"user_id": uid}, {"_id": 0}).to_list(10000)

    def parse(d):
        try:
            dt = datetime.fromisoformat(str(d).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None

    df = parse(date_from) if date_from else None
    dt_to = parse(date_to) if date_to else None

    def in_range(a):
        if category_id and a.get("category_id") != category_id:
            return False
        if company and company.lower() not in (a.get("company_name") or "").lower():
            return False
        if status and a.get("status") != status:
            return False
        if source and a.get("source") != source:
            return False
        d = parse(a.get("application_date"))
        if df and (not d or d < df):
            return False
        if dt_to and (not d or d > dt_to):
            return False
        return True

    fapps = [a for a in apps if in_range(a)]
    app_ids = {a["id"] for a in fapps}

    # Over time (monthly)
    monthly: Dict[str, int] = {}
    weekly: Dict[str, int] = {}
    for a in fapps:
        d = parse(a.get("application_date"))
        if d:
            monthly[d.strftime("%Y-%m")] = monthly.get(d.strftime("%Y-%m"), 0) + 1
            iso = d.isocalendar()
            weekly[f"{iso[0]}-W{iso[1]:02d}"] = weekly.get(f"{iso[0]}-W{iso[1]:02d}", 0) + 1

    # By category
    cats = await db.job_categories.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c for c in cats}
    by_category: Dict[str, int] = {}
    for a in fapps:
        name = cat_map.get(a.get("category_id"), {}).get("name") or a.get("category_name") or "Uncategorized"
        by_category[name] = by_category.get(name, 0) + 1

    by_company: Dict[str, int] = {}
    by_source: Dict[str, int] = {}
    for a in fapps:
        c = a.get("company_name") or "Unknown"
        by_company[c] = by_company.get(c, 0) + 1
        s = a.get("source") or "Unknown"
        by_source[s] = by_source.get(s, 0) + 1

    # Funnel
    funnel_stages = ["Saved", "Applied", "Acknowledged", "Assessment", "Interview", "Final Round", "Offer", "Accepted"]
    def stage_of(st):
        m = {
            "Saved / Interested": "Saved", "Applied": "Applied", "No Response": "Applied",
            "Application Acknowledged": "Acknowledged", "Recruiter Contacted": "Acknowledged",
            "Assessment Received": "Assessment", "Assessment Pending": "Assessment",
            "Assessment Completed": "Assessment", "Assessment Passed": "Assessment", "Assessment Failed": "Assessment",
            "Interview Scheduled": "Interview", "Interview Completed": "Interview",
            "Awaiting Interview Feedback": "Interview", "Technical Round": "Interview",
            "HR Round": "Interview", "Managerial Round": "Interview",
            "Final Round": "Final Round", "Offer Received": "Offer",
            "Offer Accepted": "Accepted", "Joined": "Accepted",
        }
        return m.get(st)
    funnel = {s: 0 for s in funnel_stages}
    for a in fapps:
        s = stage_of(a.get("status"))
        if s:
            funnel[s] += 1

    outcomes = {"Selected": 0, "Rejected": 0, "Withdrawn": 0, "On Hold": 0, "No Response": 0}
    for a in fapps:
        st = a.get("status")
        if st in ("Offer Accepted", "Joined", "Offer Received"):
            outcomes["Selected"] += 1
        elif st == "Rejected":
            outcomes["Rejected"] += 1
        elif st == "Withdrawn":
            outcomes["Withdrawn"] += 1
        elif st == "On Hold":
            outcomes["On Hold"] += 1
        elif st in ("No Response", "Applied"):
            outcomes["No Response"] += 1

    fassess = [a for a in assessments if a.get("application_id") in app_ids or not app_ids]
    assess_stats = {"Received": 0, "Pending": 0, "Completed": 0, "Passed": 0, "Failed": 0, "Expired": 0}
    for a in fassess:
        st = a.get("status")
        if st in ("Received", "Not Started"):
            assess_stats["Received"] += 1
        elif st in ("Pending", "In Progress"):
            assess_stats["Pending"] += 1
        elif st in ("Completed", "Submitted"):
            assess_stats["Completed"] += 1
        elif st == "Passed":
            assess_stats["Passed"] += 1
        elif st == "Failed":
            assess_stats["Failed"] += 1
        elif st == "Expired":
            assess_stats["Expired"] += 1

    fiv = [i for i in interviews if i.get("application_id") in app_ids or not app_ids]
    iv_stats = {"Scheduled": 0, "Completed": 0, "Passed": 0, "Failed": 0, "Awaiting Feedback": 0}
    for i in fiv:
        st = i.get("status")
        if st in ("Scheduled", "Rescheduled"):
            iv_stats["Scheduled"] += 1
        elif st == "Completed":
            iv_stats["Completed"] += 1
        elif st == "Passed":
            iv_stats["Passed"] += 1
        elif st == "Failed":
            iv_stats["Failed"] += 1
        elif st == "Awaiting Feedback":
            iv_stats["Awaiting Feedback"] += 1

    total = len(fapps) or 0
    interviewed_app_ids = {i.get("application_id") for i in fiv}
    offered = outcomes["Selected"]
    assessed_count = sum(1 for a in fassess)
    completed_assess = assess_stats["Completed"] + assess_stats["Passed"] + assess_stats["Failed"]
    passed_assess = assess_stats["Passed"]

    def pct(n, d):
        return round((n / d) * 100, 1) if d else 0.0

    rates = {
        "assessment_completion_pct": pct(completed_assess, assessed_count),
        "assessment_pass_pct": pct(passed_assess, (passed_assess + assess_stats["Failed"])),
        "application_to_interview_pct": pct(len(interviewed_app_ids), total),
        "interview_to_offer_pct": pct(offered, len(interviewed_app_ids)),
        "rejection_pct": pct(outcomes["Rejected"], total),
    }

    # Profile performance: offers/interviews per category
    profile_perf = []
    for cid, c in cat_map.items():
        capps = [a for a in fapps if a.get("category_id") == cid]
        if not capps:
            continue
        cids = {a["id"] for a in capps}
        c_iv = len({i.get("application_id") for i in fiv if i.get("application_id") in cids})
        c_off = sum(1 for a in capps if a.get("status") in ("Offer Received", "Offer Accepted", "Joined"))
        profile_perf.append({"category": c["name"], "applications": len(capps), "interviews": c_iv, "offers": c_off})

    def to_series(d):
        return [{"label": k, "value": v} for k, v in sorted(d.items())]

    return {
        "total": total,
        "over_time_monthly": to_series(monthly),
        "over_time_weekly": to_series(weekly),
        "by_category": [{"label": k, "value": v} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "by_company": [{"label": k, "value": v} for k, v in sorted(by_company.items(), key=lambda x: -x[1])][:15],
        "by_source": [{"label": k, "value": v} for k, v in sorted(by_source.items(), key=lambda x: -x[1])],
        "funnel": [{"label": s, "value": funnel[s]} for s in funnel_stages],
        "outcomes": [{"label": k, "value": v} for k, v in outcomes.items()],
        "assessment_stats": [{"label": k, "value": v} for k, v in assess_stats.items()],
        "interview_stats": [{"label": k, "value": v} for k, v in iv_stats.items()],
        "rates": rates,
        "profile_performance": profile_perf,
    }


# ============================= EXPORT / BACKUP / RESTORE =============================
def _csv_response(rows: List[dict], fields: List[str], filename: str):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@api_router.get("/export/applications.csv")
async def export_applications_csv(user: dict = Depends(get_current_user)):
    rows = await db.applications.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10000)
    fields = ["company_name", "job_title", "category_name", "status", "work_arrangement", "job_location",
              "employment_type", "salary_range", "email_used", "phone_used", "resume_name", "source",
              "recruiter_name", "recruiter_email", "application_date", "created_at"]
    return _csv_response(rows, fields, "applications.csv")


@api_router.get("/export/assessments.csv")
async def export_assessments_csv(user: dict = Depends(get_current_user)):
    rows = await db.assessments.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10000)
    fields = ["name", "type", "platform", "company_name", "status", "result", "score", "max_score",
              "date_received", "deadline", "completion_date", "created_at"]
    return _csv_response(rows, fields, "assessments.csv")


@api_router.get("/export/interviews.csv")
async def export_interviews_csv(user: dict = Depends(get_current_user)):
    rows = await db.interviews.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(10000)
    fields = ["company_name", "job_title", "round", "type", "interviewer_name", "interview_date",
              "start_time", "end_time", "timezone", "platform", "status", "result", "created_at"]
    return _csv_response(rows, fields, "interviews.csv")


BACKUP_COLLECTIONS = ["job_categories", "companies", "applications", "application_status_history",
                      "assessments", "interviews", "resumes", "contact_profiles", "reminders",
                      "activity_logs", "user_preferences"]


@api_router.get("/export/backup")
async def export_backup(user: dict = Depends(get_current_user)):
    data: Dict[str, Any] = {"version": 1, "exported_at": now_iso(), "collections": {}}
    for coll in BACKUP_COLLECTIONS:
        data["collections"][coll] = await db[coll].find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100000)
    return JSONResponse(content=data,
                        headers={"Content-Disposition": "attachment; filename=careertrack-backup.json"})


class RestorePayload(BaseModel):
    collections: Dict[str, List[Dict[str, Any]]]
    mode: str = "merge"  # merge | replace


@api_router.post("/restore")
async def restore_backup(payload: RestorePayload, user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    summary = {}
    for coll, rows in payload.collections.items():
        if coll not in BACKUP_COLLECTIONS:
            continue
        if payload.mode == "replace":
            await db[coll].delete_many({"user_id": uid})
        inserted = 0
        for r in rows:
            r.pop("_id", None)
            r["user_id"] = uid
            if not r.get("id") and coll != "user_preferences":
                r["id"] = str(uuid.uuid4())
            if payload.mode == "merge" and r.get("id"):
                exists = await db[coll].find_one({"user_id": uid, "id": r["id"]}, {"_id": 0})
                if exists:
                    continue
            await db[coll].insert_one(r)
            inserted += 1
        summary[coll] = inserted
    await log_activity(uid, "restored", "Backup", "-", f"Restore ({payload.mode}) completed")
    return {"ok": True, "mode": payload.mode, "inserted": summary}


@api_router.get("/")
async def root():
    return {"message": "CareerTrack BI API"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    for coll, idx in [("applications", "user_id"), ("assessments", "application_id"),
                      ("interviews", "application_id"), ("activity_logs", "user_id")]:
        try:
            await db[coll].create_index(idx)
        except Exception:
            pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
