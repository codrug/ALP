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
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct

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
    # Core GATE CSE-style subjects (currently limited to CN + OS)
    # "Programming and Data Structures": 0.14,
    # "Data Structures": 0.14,
    # "Algorithms": 0.12,
    "Computer Networks": 0.10,
    "Operating Systems": 0.10,
    # "Database Management Systems": 0.10,
    # "DBMS": 0.10,
    # "Theory of Computation": 0.09,
    # "TOC": 0.09,
    # "Computer Organization and Architecture": 0.08,
    # "COA": 0.08,
    # "Digital Logic": 0.06,
    # "Compiler Design": 0.05,
    # No generic fallback: unsupported subjects are simply not included
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
    if HEADING_REGEX.match(line):
        return True
    if ALL_CAPS_REGEX.match(line) and len(line) <= 80:
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


def chunk_lines(lines: list[dict]) -> list[dict]:
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
            current = {
                "title": "Untitled Section",
                "lines": [],
                "page_start": page,
                "page_end": page,
            }

        current["lines"].append(text)
        current["page_end"] = page

    if current and current["lines"]:
        chunks.append(current)

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
    # 1. Load Quiz Data scoped to this user's documents
    quizzes: dict[str, dict] = {}
    if QUIZ_INDEX.exists():
        with open(QUIZ_INDEX, "r", encoding="utf-8") as f:
            try:
                all_quizzes = json.load(f)
                # Get list of doc IDs belonging to this user
                user_doc_ids = {d.get("id") for d in documents}
                # Filter quizzes to only include those linked to this user's documents
                quizzes = {
                    qid: q
                    for qid, q in all_quizzes.items()
                    if q.get("doc_id") in user_doc_ids
                }
            except json.JSONDecodeError:
                quizzes = {}

    total_quizzes = len(quizzes)

    # Fast lookup for document metadata
    docs_by_id: dict[str, dict] = {d.get("id"): d for d in documents}

    # 2. Aggregate chapter-level mastery from quiz history
    # Keyed by (doc_id, chapter_id_or_all)
    chapter_stats: dict[tuple[str, str], dict] = {}

    for quiz in quizzes.values():
        doc_id = quiz.get("doc_id")
        if not doc_id or doc_id not in docs_by_id:
            continue

        document = docs_by_id[doc_id]
        subject = document.get("subject", "") or ""
        chapter_id_raw = quiz.get("chapter_id")  # None means "full document" quiz
        chapter_key = str(chapter_id_raw) if chapter_id_raw is not None else "ALL"

        total_questions = quiz.get("total_questions")
        score = quiz.get("score")
        if not isinstance(total_questions, int) or total_questions <= 0:
            # Older quiz records might not have total_questions; skip them for mastery
            continue
        if not isinstance(score, int) or score < 0:
            score = 0

        # Percentage mastery for this quiz session
        percentage = max(0.0, min(100.0, (score / total_questions) * 100.0))

        # Resolve a human-readable chapter title
        chapter_title = "Full Document"
        if chapter_id_raw is not None:
            for ch in document.get("chapters", []):
                if str(ch.get("id")) == str(chapter_id_raw):
                    chapter_title = ch.get("title") or chapter_title
                    break
        elif document.get("topic"):
            chapter_title = document["topic"]

        # Resolve exam weight from subject; if subject is not supported yet,
        # skip this quiz for exam-weighted readiness.
        base_weight = SUBJECT_WEIGHTS.get(subject)
        if base_weight is None:
            continue

        key = (doc_id, chapter_key)
        if key not in chapter_stats:
            chapter_stats[key] = {
                "subject": subject,
                "chapter_id": chapter_key,
                "chapter_title": chapter_title,
                "sum_percent": 0.0,
                "count": 0,
                "exam_weight": base_weight,
            }

        chapter_stats[key]["sum_percent"] += percentage
        chapter_stats[key]["count"] += 1

    # 3. Compute per-chapter mastery and exam-weighted readiness
    weighted_sum = 0.0
    weight_sum = 0.0
    mastered_chapters: list[dict] = []

    for info in chapter_stats.values():
        if info["count"] <= 0:
            continue
        mastery = info["sum_percent"] / info["count"]
        weight = info.get("exam_weight")
        if weight is None:
            continue

        weighted_sum += mastery * weight
        weight_sum += weight

        mastered_chapters.append(
            {
                "subject": info["subject"],
                "chapter_id": info["chapter_id"],
                "chapter_title": info["chapter_title"],
                "mastery": mastery,
                "exam_weight": weight,
            }
        )

    if weight_sum > 0:
        readiness = int(round(weighted_sum / weight_sum))
    else:
        # If we don't have any weighted mastery data (e.g., no quizzes for
        # supported subjects like Computer Networks / Operating Systems),
        # we report readiness as 0 so the UI can signal "not enough data".
        readiness = 0

    # 4. Identify top risk chapters (low mastery × high exam weight)
    risk_chapters: list[dict] = []
    if mastered_chapters:
        # Higher "risk_metric" means more exam-important and lower mastery
        mastered_chapters.sort(
            key=lambda c: ((100.0 - c["mastery"]) * c["exam_weight"]), reverse=True
        )
        for chapter in mastered_chapters[:3]:
            # For the UI bar, represent "risk" as inverse of mastery (clipped)
            risk_score = max(10, min(100, int(round(100.0 - chapter["mastery"]))))
            name = chapter["chapter_title"] or (chapter["subject"] or "Chapter")
            risk_chapters.append({"name": name, "score": risk_score})
    elif documents:
        # Fallback if no quizzes taken yet but docs exist
        risk_chapters.append({"name": documents[0].get("subject", "General"), "score": 42})

    # 5. Determine Next Action & Type (for smart quiz recommendation)
    next_action = ""
    next_action_type = "upload"  # upload | diagnostic | subject | expand

    if not documents:
        next_action = "Upload a GATE syllabus to start."
        next_action_type = "upload"
    elif total_quizzes == 0:
        next_action = (
            f"Take a diagnostic quiz to benchmark your readiness across all {len(documents)} synchronized modules."
        )
        next_action_type = "diagnostic"
    elif readiness < 50:
        # Find the weakest subject or chapter for targeted recommendation
        if mastered_chapters:
            weakest = mastered_chapters[0]["chapter_title"]
            next_action = (
                f"Critical gap in {weakest}. Recommended: Subject-wise or chapter-wise quiz to isolate and eliminate micro-gaps."
            )
            next_action_type = "subject"
        else:
            next_action = "High risk detected. Recommended: Full diagnostic to identify weak foundations."
            next_action_type = "diagnostic"
    elif readiness < 80:
        if mastered_chapters:
            weakest = mastered_chapters[0]["chapter_title"]
            next_action = (
                f"Focus on {weakest} — a targeted quiz will close the gap to 80% mastery."
            )
            next_action_type = "subject"
        else:
            next_action = "Run a diagnostic quiz to validate your progress across all topics."
            next_action_type = "diagnostic"
    else:
        next_action = "Strong command detected. Expand your syllabus coverage or re-validate with a diagnostic."
        next_action_type = "expand"

    # Collect unique subjects from user docs for frontend
    subjects = list({d.get("subject", "") for d in documents if d.get("subject")})

    return {
        "readiness": readiness,
        "riskChapters": risk_chapters,
        "trend": [readiness - 10, readiness - 5, readiness],
        "nextAction": next_action,
        "nextActionType": next_action_type,
        "subjects": subjects,
        "hasContent": total_quizzes > 0,
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
    return {"status": "deleted", "id": doc_id}


# [UPDATED] Dashboard Summary filtered by User ID
@app.get("/dashboard/summary")
def dashboard_summary(user_id: str = Query(..., description="The ID of the current user")):
    all_docs = load_documents()
    user_docs = [d for d in all_docs if d.get("user_id") == user_id]
    return compute_dashboard_summary(user_id, user_docs)


# [UPDATED] Upload Document now saves User ID
@app.post("/upload")
async def upload_document(
        file: UploadFile = File(...),
        subject: str = Form(...),
        topic: str = Form(...),
        exam: str = Form("GATE"),
        user_id: str = Form(...),  # Require User ID
):
    if not allowed_extension(file.filename or ""):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed.")

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds size limit.")

    file_hash = hashlib.sha256(contents).hexdigest()
    documents = load_documents()

    # Check Global Duplicate (across ALL users)
    global_existing = next((d for d in documents if d.get("file_hash") == file_hash), None)
    
    if global_existing:
        # If the current user already has this file, just return it
        user_existing = next((d for d in documents if d.get("file_hash") == file_hash and d.get("user_id") == user_id), None)
        if user_existing:
            return {"file_id": user_existing["id"], "duplicate": True, "status": user_existing.get("status", "Processing")}
        
        # New user uploading existing file: INHERIT metadata to save keys/time
        doc_id = str(uuid.uuid4())
        new_record = {
            "id": doc_id,
            "user_id": user_id,
            "file_name": normalize_filename(file.filename or "upload"),
            "subject": subject,
            "topic": topic,
            "exam": exam,
            "status": global_existing.get("status", "Processing"),
            "uploaded_at": datetime.now().isoformat(),
            "file_path": global_existing.get("file_path"),
            "file_hash": file_hash,
            "chapters": global_existing.get("chapters", []),
            "chunks": global_existing.get("chunks", []),
            "raw_text_path": global_existing.get("raw_text_path"),
        }
        documents.append(new_record)
        save_documents(documents)
        return {"file_id": doc_id, "duplicate": True, "status": new_record["status"]}

    doc_id = str(uuid.uuid4())
    original_name = normalize_filename(file.filename or "upload")
    file_ext = Path(original_name).suffix.lower()
    stored_name = f"{doc_id}{file_ext}"
    stored_path = UPLOAD_DIR / stored_name
    ensure_storage()
    with stored_path.open("wb") as handle:
        handle.write(contents)

    document_record = {
        "id": doc_id,
        "user_id": user_id,  # SAVE USER ID
        "file_name": original_name,
        "subject": subject,
        "topic": topic,
        "exam": exam,
        "status": "Processing",
        "uploaded_at": datetime.now().isoformat(),
        "file_path": str(stored_path),
        "file_hash": file_hash,
        "chapters": [],
        "chunks": [],
    }
    documents.append(document_record)
    save_documents(documents)

    return {"file_id": doc_id, "duplicate": False}


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

    chunks = chunk_lines(lines)
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