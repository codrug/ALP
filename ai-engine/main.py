from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
print("FastAPI loading...")
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv
import hashlib
import json
import os
import re
import uuid
import logging
import shutil
import warnings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct

# Suppress noisy Pydantic shadowing warnings from third-party libraries
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic.*")
# Suppress deprecated warnings from fastembed internals
logging.getLogger("fastembed").setLevel(logging.ERROR)

# Load environment variables FIRST
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(root_dir, '.env'))

# Import the Quiz Router
from routers import quiz
from services.gemini import GeminiService

app = FastAPI()

# Include the Quiz Router
app.include_router(quiz.router)

DATA_DIR = Path(current_dir) / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DOC_DIR = DATA_DIR / "documents"
DOC_INDEX = DATA_DIR / "documents.json"
QUIZ_INDEX = DATA_DIR / "quizzes.json"

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 5 * 1024 * 1024
MIN_TEXT_CHARS = 250
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "alp_chunks")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))

logger = logging.getLogger("alp")

# Subject-level exam weightings used to compute exam-weighted readiness.
# These are relative weights (they do not sum to 1.0).
# For now we only support two subjects explicitly. Others are intentionally
# commented out so they do NOT silently fall back.
SUBJECT_WEIGHTS: dict[str, float] = {
    # Core GATE CSE-style subjects (CN + OS + DS)
    "Computer Networks": 0.10,
    "Operating Systems": 0.10,
    "Data Structures": 0.14,
    # "Programming and Data Structures": 0.14,
    # "Algorithms": 0.12,
    # "Database Management Systems": 0.10,
    # "DBMS": 0.10,
    # "Theory of Computation": 0.09,
    # "TOC": 0.09,
    # "Computer Organization and Architecture": 0.08,
    # "COA": 0.08,
    # "Digital Logic": 0.06,
    # "Compiler Design": 0.05,
    # "General Aptitude": 0.15,
    # "Engineering Mathematics": 0.13,
    # "Discrete Mathematics": 0.13,
}

# Allow CORS for frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_qdrant_client() -> Optional[QdrantClient]:
    if not QDRANT_URL or not QDRANT_API_KEY:
        return None
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)


@app.on_event("startup")
def ensure_qdrant_collection() -> None:
    client = get_qdrant_client()
    if client is None:
        return

    try:
        collections = client.get_collections().collections
        exists = any(c.name == QDRANT_COLLECTION for c in collections)
        if not exists:
            client.create_collection(
                collection_name=QDRANT_COLLECTION,
                vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
            )
        app.state.qdrant = client
    except Exception as exc:
        logger.warning("Qdrant init skipped: %s", exc)


def ensure_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DOC_DIR.mkdir(parents=True, exist_ok=True)
    if not DOC_INDEX.exists():
        DOC_INDEX.write_text("[]", encoding="utf-8")
    if not QUIZ_INDEX.exists():
        QUIZ_INDEX.write_text("{}", encoding="utf-8")


def load_documents() -> list[dict]:
    ensure_storage()
    with DOC_INDEX.open("r", encoding="utf-8") as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError:
            return []


def save_documents(documents: list[dict]) -> None:
    ensure_storage()
    with DOC_INDEX.open("w", encoding="utf-8") as handle:
        json.dump(documents, handle, indent=2)


def normalize_filename(filename: str) -> str:
    return Path(filename).name


def allowed_extension(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def extract_pdf_lines(file_path: Path) -> list[dict]:
    import pdfplumber

    lines: list[dict] = []
    with pdfplumber.open(str(file_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""
            for line in page_text.splitlines():
                cleaned = line.strip()
                if cleaned:
                    lines.append({"text": cleaned, "page": page_number, "style": ""})
    return lines


def extract_docx_lines(file_path: Path) -> list[dict]:
    import docx

    doc = docx.Document(str(file_path))
    lines: list[dict] = []
    for index, paragraph in enumerate(doc.paragraphs, start=1):
        text = paragraph.text.strip()
        if not text:
            continue
        style_name = ""
        if paragraph.style is not None:
            style_name = paragraph.style.name or ""
        lines.append({"text": text, "page": index, "style": style_name})
    return lines


HEADING_REGEX = re.compile(r"^\s*(chapter|unit|module|topic)\s+\d+\b[:.\-]?\s+.+", re.IGNORECASE)
ALL_CAPS_REGEX = re.compile(r"^[A-Z][A-Z0-9 \-&/]{4,}$")


def is_heading(line: str, style: str) -> bool:
    if style.lower().startswith("heading"):
        return True
    
    # Check length first to skip long paragraphs early
    if not line or len(line) > 120:
        return False
        
    # Stricter Pattern: Must start with a number/letter or heading keywords
    # "Chapter 1", "Unit 2", "1. Topic Name", "A. Topic Name"
    if HEADING_REGEX.match(line):
        return True
    
    # Pattern: "1. " or "1) " or "A. " or "A) "
    if re.match(r"^\s*(\d+|[A-Z])[\.\)]\s+[A-Z].+", line):
        return True
        
    return False


def derive_concepts(title: str, lines: list[str]) -> list[str]:
    concepts: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("-") or stripped.startswith("*"):
            cleaned = stripped.lstrip("-* ").strip()
            if cleaned:
                concepts.append(cleaned)
        if len(concepts) >= 3:
            break

    if concepts:
        return concepts[:3]

    title_bits = re.split(r"[:\-]", title)
    fallback = title_bits[0].strip() if title_bits else title.strip()
    return [fallback] if fallback else ["Core concepts"]


def chunk_lines(lines: list[dict], fallback_title: str = "Untitled Section") -> list[dict]:
    chunks: list[dict] = []
    current: Optional[dict] = None

    for entry in lines:
        text = entry["text"]
        style = entry.get("style", "")
        page = entry["page"]

        if is_heading(text, style):
            if current and current["lines"]:
                chunks.append(current)
            current = {
                "title": text,
                "lines": [],
                "page_start": page,
                "page_end": page,
            }
            continue

        if current is None:
            # Use the first line as initial title only if it's reasonably short (<= 120 chars)
            # Otherwise use the provided fallback_title (which is usually the filename)
            initial_title = text if (text and len(text) <= 120) else fallback_title
            current = {
                "title": initial_title,
                "lines": [],
                "page_start": page,
                "page_end": page,
            }

        current["lines"].append(text)
        current["page_end"] = page

    if current and current["lines"]:
        chunks.append(current)

    # STRICT CHECK: If we only have 1 chunk and its title is the fallback (meaning no heading found)
    # or if we have 0 chunks, return None or empty to signal failure
    if not chunks or (len(chunks) == 1 and chunks[0]["title"] == fallback_title):
        return []

    return chunks


def format_document(document: dict) -> dict:
    uploaded_at = document.get("uploaded_at")
    date_str = ""
    if uploaded_at:
        date_str = uploaded_at.split("T")[0]
    return {
        "id": document["id"],
        "user_id": document.get("user_id", ""),  # Return User ID
        "fileName": document.get("file_name", ""),
        "subject": document.get("subject", ""),
        "topic": document.get("topic", ""),
        "exam": document.get("exam", "GATE"),
        "date": date_str,
        "status": document.get("status", "Processing"),
        "chapters": document.get("chapters", []),
    }


# [UPDATED] Dashboard Calculation logic with User Isolation and exam-weighted mastery
def compute_dashboard_summary(user_id: str, documents: list[dict]) -> dict:
    # 1. Load & Filter Quiz Data
    raw_quizzes: dict[str, dict] = {}
    if QUIZ_INDEX.exists():
        with open(QUIZ_INDEX, "r", encoding="utf-8") as f:
            try:
                all_data = json.load(f)
                user_doc_ids = {d.get("id") for d in documents}
                # [NEW] Include diagnostic quizzes as well as document-specific ones
                raw_quizzes = {
                    qid: q for qid, q in all_data.items() 
                    if q.get("doc_id") in user_doc_ids or q.get("doc_id") == "diagnostic"
                }
            except json.JSONDecodeError:
                raw_quizzes = {}

    # Consolidate: Only quizzes with progress (score > 0 OR at least one weakness recorded)
    final_quizzes = sorted(
        [
            q for q in raw_quizzes.values()
            if q.get("created_at") 
            and isinstance(q.get("total_questions"), int) 
            and q.get("total_questions") > 0
            and (q.get("score", 0) > 0 or len(q.get("weaknesses", [])) > 0)
        ],
        key=lambda q: q["created_at"]
    )
    total_quizzes = len(final_quizzes)
    docs_by_id = {d.get("id"): d for d in documents}

    def calculate_readiness_from_list(quiz_list):
        # Initialize stats for ALL synchronized documents to 0% mastery
        stats = {}
        for doc in documents:
            d_id = doc.get("id")
            s = doc.get("subject", "General") or "General"
            # Default to 1.0 if subject is unknown
            weight = SUBJECT_WEIGHTS.get(s, 1.0)
            
            # Treat each module (full document) as a unit in the weighted average
            key = (d_id, "ALL")
            if key not in stats:
                stats[key] = {
                    "sum": 0.0, 
                    "count": 0, 
                    "weight": weight, 
                    "title": doc.get("topic") or doc.get("subject") or "Untitled Module"
                }

        if not quiz_list and not stats: return 0, []
        
        # Overlay actual quiz data
        for q in quiz_list:
            d_id = q.get("doc_id")
            
            # Diagnostic quizzes are treated as global assessments
            if d_id == "diagnostic":
                # Special logic: Diagnostic quizzes directly reflect overall readiness
                # but we can't easily attribute them to specific chapters.
                # For now, we skip them for per-chapter stats but will use them for trend.
                continue

            if d_id not in docs_by_id: continue
            s = docs_by_id[d_id].get("subject", "General") or "General"
            weight = SUBJECT_WEIGHTS.get(s, 1.0)

            tq = q.get("total_questions", 1)
            ws = q.get("weaknesses", []) or []
            fw = sum(1 for w in ws if str(w).lower() == "foundation")
            aw = sum(1 for w in ws if str(w).lower() == "application")
            ow = len(ws) - fw - aw
            ew = float(fw) + float(ow) + 1.5 * float(aw)
            p = max(0.0, min(100.0, ((max(0.0, float(tq) - ew)) / float(tq)) * 100.0))

            c_id = q.get("chapter_id")
            key = (d_id, str(c_id) if c_id is not None else "ALL")
            
            # If this chapter was not in initial stats (e.g. sub-chapter quiz), add it
            if key not in stats:
                title = "Full Document"
                if c_id is not None:
                    for ch in docs_by_id[d_id].get("chapters", []):
                        if str(ch.get("id")) == str(c_id):
                            title = ch.get("title") or title
                            break
                elif docs_by_id[d_id].get("topic"): title = docs_by_id[d_id]["topic"]
                stats[key] = {"sum": 0.0, "count": 0, "weight": weight, "title": title}
            
            stats[key]["sum"] += p
            stats[key]["count"] += 1

        w_sum, wt_sum, mastered_list = 0.0, 0.0, []
        for k, info in stats.items():
            m = info["sum"] / info["count"] if info["count"] > 0 else 0.0
            w_sum += m * info["weight"]
            wt_sum += info["weight"]
            mastered_list.append({
                "subject": docs_by_id[k[0]].get("subject", ""),
                "chapter_id": k[1], "chapter_title": info["title"],
                "mastery": m, "exam_weight": info["weight"], "passed": m >= 80.0,
                "session_count": info["count"]
            })
        return (int(round(w_sum / wt_sum)) if wt_sum > 0 else 0), mastered_list

    # 2. Calculate overall readiness and per-chapter mastery
    readiness, mastered_chapters = calculate_readiness_from_list(final_quizzes)

    # 2b. Risk chapters (PRD §9.2)
    risk_chapters = []
    if mastered_chapters:
        attempted_chapters = [c for c in mastered_chapters if c.get("session_count", 0) > 0]
        attempted_chapters.sort(key=lambda c: ((100.0 - c["mastery"]) * c["exam_weight"]), reverse=True)
        for c in attempted_chapters[:3]:
            risk_chapters.append({"name": c["chapter_title"], "score": int(round(100.0 - c["mastery"]))})

    # 3. Trend & Action
    trend = []
    if total_quizzes > 0:
        # Trend should ideally show the evolution of 'readiness'
        if total_quizzes >= 3:
            indices = [max(0, total_quizzes // 3 - 1), max(0, 2 * total_quizzes // 3 - 1), total_quizzes - 1]
        else:
            indices = list(range(total_quizzes))
        
        for idx in indices:
            subset = final_quizzes[:idx+1]
            # If the last quiz in the subset is a diagnostic one, its score is highly representative
            last_q = subset[-1]
            if last_q.get("doc_id") == "diagnostic":
                # Use diagnostic mastery directly for trend point
                tq = last_q.get("total_questions", 1)
                ws = last_q.get("weaknesses", []) or []
                fw = sum(1 for w in ws if str(w).lower() == "foundation")
                aw = sum(1 for w in ws if str(w).lower() == "application")
                ow = len(ws) - fw - aw
                ew = float(fw) + float(ow) + 1.5 * float(aw)
                p = max(0.0, min(100.0, ((max(0.0, float(tq) - ew)) / float(tq)) * 100.0))
                trend.append(int(round(p)))
            else:
                val, _ = calculate_readiness_from_list(subset)
                trend.append(val)
    else:
        trend = [0]

    next_action, next_action_type = "", "upload"
    if not documents:
        next_action = "Upload notes to start."
    elif total_quizzes == 0:
        next_action = f"Take a diagnostic quiz across {len(documents)} modules."
        next_action_type = "diagnostic"
    elif readiness < 80:
        next_action = f"Focus on {mastered_chapters[0]['chapter_title'] if mastered_chapters else 'weakness'} to hit the 80% mark."
        next_action_type = "subject"
    else:
        next_action = "Strong command detected. Expand coverage."
        next_action_type = "expand"

    # 4. Gaps
    all_ws = []
    for q in final_quizzes:
        all_ws.extend(q.get("weaknesses", []))
    from collections import Counter
    top_ws = [w[0] for w in Counter([w for w in all_ws if w != "General"]).most_common(3)]

    return {
        "readiness": readiness,
        "riskChapters": risk_chapters,
        "trend": trend,
        "topWeaknesses": top_ws,
        "nextAction": next_action,
        "nextActionType": next_action_type,
        "subjects": list({d.get("subject", "") for d in documents if d.get("subject")}),
        "hasContent": total_quizzes > 0,
        "chaptersMastery": mastered_chapters,
    }


class ChapterPatch(BaseModel):
    id: str
    title: Optional[str] = None
    selected: Optional[bool] = None


class DocumentPatch(BaseModel):
    subject: Optional[str] = None
    topic: Optional[str] = None
    exam: Optional[str] = None
    status: Optional[str] = None
    chapters: Optional[list[ChapterPatch]] = None


@app.get("/health")
def read_health():
    return {
        "status": "ok",
        "service": "fastapi-ai",
        "timestamp": datetime.now().isoformat(),
    }


# [UPDATED] List Documents filtered by User ID
@app.get("/documents")
def list_documents(user_id: str = Query(..., description="The ID of the current user")):
    all_docs = load_documents()
    # Filter: Only documents belonging to this user
    user_docs = [d for d in all_docs if d.get("user_id") == user_id]
    return {"items": [format_document(doc) for doc in user_docs]}


@app.put("/documents/{doc_id}")
def update_document(doc_id: str, payload: DocumentPatch):
    documents = load_documents()
    document = next((doc for doc in documents if doc.get("id") == doc_id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    if payload.subject is not None:
        document["subject"] = payload.subject
    if payload.topic is not None:
        document["topic"] = payload.topic
    if payload.exam is not None:
        document["exam"] = payload.exam
    if payload.status is not None:
        document["status"] = payload.status

    if payload.chapters is not None:
        chapters_by_id = {c.get("id"): c for c in document.get("chapters", [])}
        for patch in payload.chapters:
            existing = chapters_by_id.get(patch.id)
            if existing is None:
                continue
            if patch.title is not None:
                existing["title"] = patch.title
            if patch.selected is not None:
                existing["selected"] = patch.selected

    save_documents(documents)
    return format_document(document)


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    documents = load_documents()
    document = next((doc for doc in documents if doc.get("id") == doc_id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = Path(document.get("file_path", ""))
    if file_path.exists():
        file_path.unlink(missing_ok=True)

    doc_dir = DOC_DIR / doc_id
    if doc_dir.exists():
        shutil.rmtree(doc_dir, ignore_errors=True)

    documents = [doc for doc in documents if doc.get("id") != doc_id]
    save_documents(documents)

    # --- Qdrant Sync: Delete points for this document ---
    qdrant_client = getattr(app.state, "qdrant", None)
    if qdrant_client:
        from qdrant_client import models
        try:
            qdrant_client.delete(
                collection_name=QDRANT_COLLECTION,
                points_selector=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="doc_id",
                            match=models.MatchValue(value=doc_id),
                        ),
                    ]
                ),
            )
        except Exception as e:
            print(f"Warning: Failed to delete Qdrant points for {doc_id}: {e}")

    return {"status": "deleted", "id": doc_id}


# [UPDATED] Dashboard Summary filtered by User ID
@app.get("/dashboard/summary")
def dashboard_summary(user_id: str = Query(..., description="The ID of the current user")):
    all_docs = load_documents()
    user_docs = [d for d in all_docs if d.get("user_id") == user_id]
    return compute_dashboard_summary(user_id, user_docs)


# [UPDATED] Upload Document now saves User ID
@app.post("/ingest/parse")
async def ingest_parse(
    file: UploadFile = File(...),
    suggested_topic: Optional[str] = Form(None)
):
    if not allowed_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed.")
    
    # Save to memory/temp for parsing
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds size limit.")

    temp_path = DATA_DIR / "temp" / f"temp_{uuid.uuid4()}{Path(file.filename).suffix.lower()}"
    temp_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path.write_bytes(contents)
    
    try:
        if temp_path.suffix.lower() == ".pdf":
            lines = extract_pdf_lines(temp_path)
        elif temp_path.suffix.lower() == ".docx":
            lines = extract_docx_lines(temp_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")

        # Default to the user's suggested topic if provided, otherwise original filename
        fallback = suggested_topic if suggested_topic else Path(file.filename).stem.replace("_", " ").title()
        
        chunks = chunk_lines(lines, fallback_title=fallback)
        
        # If no internal headings found, treat the whole thing as one unit named after the requested topic
        if not chunks:
            raw_text = "\n".join([line["text"] for line in lines])
            chunks = [{
                "title": fallback,
                "lines": [line["text"] for line in lines],
                "page_start": 1,
                "page_end": lines[-1]["page"] if lines else 1
            }]
            
        chapters = []
        for index, chunk in enumerate(chunks, start=1):
            concepts = derive_concepts(chunk["title"], chunk["lines"])
            chapters.append({
                "id": str(index),
                "title": chunk["title"],
                "concepts": concepts,
                "selected": True,
                "lines": chunk["lines"],
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
            })
            
        return {"chapters": chapters, "file_name": file.filename}
    finally:
        if temp_path.exists():
            temp_path.unlink()

@app.post("/upload")
async def upload_document(
        file: UploadFile = File(...),
        subject: str = Form(...),
        topic: str = Form(...),
        exam: str = Form("GATE"),
        user_id: str = Form(...),
        chapters_json: str = Form(...), # Recieve the final chapters as JSON string
):
    if not allowed_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed.")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds size limit.")

    chapters = json.loads(chapters_json)
    
    file_hash = hashlib.sha256(contents).hexdigest()
    documents = load_documents()

    # Create permanent record
    doc_id = str(uuid.uuid4())
    original_name = normalize_filename(file.filename or "upload")
    file_ext = Path(original_name).suffix.lower()
    stored_name = f"{doc_id}{file_ext}"
    stored_path = UPLOAD_DIR / stored_name
    ensure_storage()
    
    with stored_path.open("wb") as handle:
        handle.write(contents)

    # Setup document directory
    document_dir = DOC_DIR / doc_id
    document_dir.mkdir(parents=True, exist_ok=True)
    
    # Save chunks/metadata
    chunk_metadata = []
    final_chapters = []
    full_text_lines = []
    
    for ch in chapters:
        ch_text = "\n".join(ch["lines"]).strip()
        full_text_lines.append(ch_text)
        
        ch_id = ch["id"]
        chunk_file = document_dir / f"chunk_{ch_id}.txt"
        chunk_file.write_text(ch_text, encoding="utf-8")
        
        final_chapters.append({
            "id": ch_id,
            "title": ch["title"],
            "concepts": ch["concepts"],
            "selected": ch.get("selected", True),
        })
        chunk_metadata.append({
            "title": ch["title"],
            "page_start": ch["page_start"],
            "page_end": ch["page_end"],
            "text_path": str(chunk_file),
        })

    raw_text_path = document_dir / "raw.txt"
    raw_text_path.write_text("\n".join(full_text_lines), encoding="utf-8")

    document_record = {
        "id": doc_id,
        "user_id": user_id,
        "file_name": original_name,
        "subject": subject,
        "topic": topic,
        "exam": exam,
        "status": "Active", # Set to Active immediately as it's already parsed
        "uploaded_at": datetime.now().isoformat(),
        "file_path": str(stored_path),
        "file_hash": file_hash,
        "chapters": final_chapters,
        "chunks": chunk_metadata,
        "raw_text_path": str(raw_text_path),
    }
    
    documents.append(document_record)
    save_documents(documents)

    # --- Trigger Qdrant in background or immediately ---
    # (Existing Qdrant logic from parse_document can be moved here)
    qdrant_client = getattr(app.state, "qdrant", None)
    if qdrant_client and chunk_metadata:
        try:
            chunk_texts = [line[:2000] for line in full_text_lines]
            vectors = GeminiService.generate_embeddings(chunk_texts)
            if vectors and len(vectors) == len(chunk_texts):
                points = []
                for idx, (vec, cm) in enumerate(zip(vectors, chunk_metadata)):
                    point_id = str(uuid.uuid4())
                    points.append(PointStruct(
                        id=point_id,
                        vector=vec,
                        payload={
                            "doc_id": doc_id,
                            "user_id": user_id,
                            "chapter_index": idx + 1,
                            "title": cm["title"],
                            "page_start": cm["page_start"],
                            "page_end": cm["page_end"],
                            "subject": subject,
                            "topic": topic,
                        }
                    ))
                qdrant_client.upsert(collection_name=QDRANT_COLLECTION, points=points)
        except Exception:
            pass

    return {"file_id": doc_id, "status": "Active", "chapters": final_chapters}


@app.post("/documents/{doc_id}/parse")
def parse_document(doc_id: str):
    documents = load_documents()
    document = next((doc for doc in documents if doc.get("id") == doc_id), None)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    if document["status"] == "Active":
        return {"file_id": doc_id, "status": "Active", "chapters": document.get("chapters", [])}

    file_path = Path(document.get("file_path", ""))
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Stored file missing.")

    file_ext = file_path.suffix.lower()
    if file_ext == ".pdf":
        lines = extract_pdf_lines(file_path)
    elif file_ext == ".docx":
        lines = extract_docx_lines(file_path)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type for parsing.")

    raw_text = "\n".join([entry["text"] for entry in lines])
    if len(raw_text) < MIN_TEXT_CHARS:
        raise HTTPException(status_code=422, detail="Extracted text is too short or garbled.")

    # Pass filename (without ext) as fallback title
    fallback = file_path.stem.replace("_", " ").title()
    chunks = chunk_lines(lines, fallback_title=fallback)
    if not chunks:
        raise HTTPException(status_code=422, detail="Unable to detect chapter boundaries.")

    document_dir = DOC_DIR / doc_id
    document_dir.mkdir(parents=True, exist_ok=True)
    raw_text_path = document_dir / "raw.txt"
    raw_text_path.write_text(raw_text, encoding="utf-8")

    chapters = []
    chunk_metadata = []
    for index, chunk in enumerate(chunks, start=1):
        chunk_text = "\n".join(chunk["lines"]).strip()
        if not chunk_text:
            continue
        chunk_file = document_dir / f"chunk_{index}.txt"
        chunk_file.write_text(chunk_text, encoding="utf-8")

        concepts = derive_concepts(chunk["title"], chunk["lines"])
        chapters.append({
            "id": str(index),
            "title": chunk["title"],
            "concepts": concepts,
            "selected": True,
        })
        chunk_metadata.append({
            "title": chunk["title"],
            "page_start": chunk["page_start"],
            "page_end": chunk["page_end"],
            "text_path": str(chunk_file),
        })

    document["status"] = "Active"
    document["chapters"] = chapters
    document["raw_text_path"] = str(raw_text_path)
    document["chunks"] = chunk_metadata
    
    # Auto-assign topic if missing or generic
    if not document.get("topic") or document["topic"].lower() in ["none", "all", "untitled"]:
        document["topic"] = fallback

    save_documents(documents)

    # --- Qdrant Embedding & Upsert ---
    qdrant_client = getattr(app.state, "qdrant", None)
    if qdrant_client and chunk_metadata:
        try:
            chunk_texts = []
            for cm in chunk_metadata:
                txt_path = Path(cm["text_path"])
                if txt_path.exists():
                    chunk_texts.append(txt_path.read_text(encoding="utf-8")[:2000])
                else:
                    chunk_texts.append("")

            vectors = GeminiService.generate_embeddings(chunk_texts)
            if vectors and len(vectors) == len(chunk_texts):
                points = []
                for idx, (vec, cm) in enumerate(zip(vectors, chunk_metadata)):
                    point_id = str(uuid.uuid4())
                    points.append(PointStruct(
                        id=point_id,
                        vector=vec,
                        payload={
                            "doc_id": doc_id,
                            "user_id": document.get("user_id", ""),
                            "chapter_index": idx + 1,
                            "title": cm["title"],
                            "page_start": cm["page_start"],
                            "page_end": cm["page_end"],
                            "subject": document.get("subject", ""),
                            "topic": document.get("topic", ""),
                        }
                    ))
                qdrant_client.upsert(
                    collection_name=QDRANT_COLLECTION,
                    points=points,
                )
                logger.info(f"Upserted {len(points)} vectors to Qdrant for doc {doc_id}")
        except Exception as exc:
            logger.warning(f"Qdrant upsert failed for doc {doc_id}: {exc}")

    return {"file_id": doc_id, "status": document["status"], "chapters": chapters}


if __name__ == "__main__":
    import uvicorn
    import sys
    
    try:
        print("Starting AI Engine on http://localhost:8000")
        uvicorn.run(app, host="localhost", port=8000, log_level="info")
    except Exception as e:
        print(f"FATAL STARTUP ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)