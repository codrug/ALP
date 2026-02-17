from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
from typing import Optional
from pydantic import BaseModel
import hashlib
import json
import os
import re
import uuid
import logging
import shutil

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# Load environment variables
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(root_dir, '.env'))

app = FastAPI()

DATA_DIR = Path(current_dir) / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DOC_DIR = DATA_DIR / "documents"
DOC_INDEX = DATA_DIR / "documents.json"

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = int(os.getenv("MAX_UPLOAD_MB", "20")) * 1024 * 1024
MIN_TEXT_CHARS = int(os.getenv("MIN_TEXT_CHARS", "200"))
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "alp_chunks")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))

logger = logging.getLogger("alp")

# Allow CORS for frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
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


def load_documents() -> list[dict]:
    ensure_storage()
    with DOC_INDEX.open("r", encoding="utf-8") as handle:
        return json.load(handle)


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
        "fileName": document.get("file_name", ""),
        "subject": document.get("subject", ""),
        "topic": document.get("topic", ""),
        "exam": document.get("exam", "GATE"),
        "date": date_str,
        "status": document.get("status", "Processing"),
        "chapters": document.get("chapters", []),
    }


def compute_dashboard_summary(documents: list[dict]) -> dict:
    return {
        "readiness": 0,
        "riskChapters": [],
        "trend": [0, 0, 0],
        "nextAction": "Dashboard metrics will populate after quizzes are implemented.",
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


@app.get("/documents")
def list_documents():
    documents = load_documents()
    return {"items": [format_document(doc) for doc in documents]}


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


@app.get("/dashboard/summary")
def dashboard_summary():
    documents = load_documents()
    return compute_dashboard_summary(documents)


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(...),
    topic: str = Form(...),
    exam: str = Form("GATE"),
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
    existing = next((doc for doc in documents if doc.get("file_hash") == file_hash), None)
    if existing:
        return {"file_id": existing["id"], "duplicate": True}

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

    return {"file_id": doc_id, "status": document["status"], "chapters": chapters}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
