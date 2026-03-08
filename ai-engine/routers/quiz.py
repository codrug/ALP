from fastapi import APIRouter, HTTPException
from pathlib import Path
from datetime import datetime
import json
import uuid
import os
import logging
from services.gemini import GeminiService

logger = logging.getLogger("alp")

router = APIRouter(prefix="/quiz", tags=["quiz"])

# Data Paths
# We navigate up one level from 'routers' to reach 'data'
DATA_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent / "data"
QUIZ_FILE = DATA_DIR / "quizzes.json"
DOC_DIR = DATA_DIR / "documents"
DOC_INDEX = DATA_DIR / "documents.json"


def load_quizzes():
    if not QUIZ_FILE.exists():
        return {}
    with open(QUIZ_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_quizzes(data):
    with open(QUIZ_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def load_documents_index() -> list[dict]:
    """
    Lightweight access to the documents index so we can attach user_id
    to quiz sessions without importing the main FastAPI module.
    """
    if not DOC_INDEX.exists():
        return []
    try:
        with open(DOC_INDEX, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return []


def save_documents_index(documents: list[dict]):
    """Save documents index back to disk."""
    with open(DOC_INDEX, "w", encoding="utf-8") as f:
        json.dump(documents, f, indent=2)


def _update_chapter_mastery(doc_id: str, chapter_id: str | None, mastery_pct: float):
    """
    Persist per-chapter mastery score into documents.json.
    Updates the mastery_score and mastery_updated_at fields for the relevant chapter.
    """
    documents = load_documents_index()
    doc = None
    for d in documents:
        if d.get("id") == doc_id:
            doc = d
            break
    if not doc:
        return

    if chapter_id is not None:
        for ch in doc.get("chapters", []):
            if str(ch.get("id")) == str(chapter_id):
                ch["mastery_score"] = round(mastery_pct, 1)
                ch["mastery_updated_at"] = datetime.now().isoformat()
                ch["mastery_passed"] = mastery_pct >= 80.0
                break
    else:
        # Full-document quiz — store mastery at document level
        doc["mastery_score"] = round(mastery_pct, 1)
        doc["mastery_updated_at"] = datetime.now().isoformat()
        doc["mastery_passed"] = mastery_pct >= 80.0

    save_documents_index(documents)


# ─── Quiz Generation (with §12 Validation Pipeline) ─────────────

@router.post("/generate/{doc_id}")
def generate_quiz(doc_id: str, chapter_id: str = None):
    """
    Triggers Gemini to generate a quiz from the document's text.
    Now includes PRD §14.3 RAG for full-document quizzes.
    """
    # 1. Resolve Document & User
    doc_path = DOC_DIR / doc_id
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail="Document content not found")

    docs = load_documents_index()
    doc_meta = next((d for d in docs if d.get("id") == doc_id), None)
    if not doc_meta:
        raise HTTPException(status_code=404, detail="Document metadata not found")
    
    user_id = doc_meta.get("user_id", "")
    topic = doc_meta.get("topic", "")

    # 2. Fetch Context (Scoped or RAG)
    context_text = ""
    used_rag = False

    if chapter_id:
        # Scoped to one chapter — read specific chunk
        chunk_path = doc_path / f"chunk_{chapter_id}.txt"
        if chunk_path.exists():
            context_text = chunk_path.read_text(encoding="utf-8")
    else:
        # Full-document quiz — attempt RAG (PRD §14.3)
        # Search for top 5 most 'central' or 'relevant' chapters
        top_chunks = GeminiService.retrieve_context(user_id, doc_id, query=topic, limit=5)
        
        if top_chunks and isinstance(top_chunks, list):
            found_texts = []
            for chunk in top_chunks:
                d_id = chunk.get("doc_id")
                idx = chunk.get("chapter_index")
                # Ensure we only fetch from the requested doc_id for standard quizzes
                if d_id != doc_id: continue

                cp = DOC_DIR / d_id / f"chunk_{idx}.txt"
                if cp.exists():
                    found_texts.append(cp.read_text(encoding="utf-8"))
            if found_texts:
                context_text = "\n\n---\n\n".join(found_texts)
                used_rag = True
                logger.info(f"RAG: Composed context from {len(found_texts)} retrieved chapters for doc {doc_id}")

    # Fallback to full doc if RAG was unsuccessful or skipped
    if not context_text:
        raw_text_path = doc_path / "raw.txt"
        if raw_text_path.exists():
            context_text = raw_text_path.read_text(encoding="utf-8")
        else:
            raise HTTPException(status_code=404, detail="Source text not found")

    # 3. Call Gemini Service
    questions = GeminiService.generate_quiz(context_text)
    
    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate questions")

    # [ROBUSTNESS] Validate that 'questions' is a list and has at least one valid question
    if not isinstance(questions, list) or len(questions) == 0:
        raise HTTPException(status_code=500, detail="AI returned empty or invalid question set")

    # ─── §12.1 Rule-based validation ───────────────────────────
    valid_questions, rejected_rules = GeminiService.rule_based_validate(questions)

    # Log rule-rejected questions to error system
    if rejected_rules:
        from services.error_logger import log_system_error
        for rej in rejected_rules:
            log_system_error(
                error_type=f"rule_rejected_{rej['reason']}",
                model_used="gemini-current",
                prompt="[Rule-Based Validation]",
                offending_content=rej["question"],
                metadata={"doc_id": doc_id, "chapter_id": chapter_id}
            )
        logger.info(f"Rule-based validation: {len(valid_questions)} passed, {len(rejected_rules)} rejected")

    if not valid_questions:
        raise HTTPException(status_code=500, detail="AI response was missing required fields")

    # ─── §12.2 Verifier LLM validation ───────────────────────────
    verified_questions = GeminiService.verify_quiz_questions(valid_questions, context_text)
    logger.info(f"Verifier LLM: {len(verified_questions)}/{len(valid_questions)} questions passed")

    if not verified_questions:
        raise HTTPException(status_code=500, detail="All questions failed verification")

    # 3. Save Quiz Session
    quiz_id = str(uuid.uuid4())

    quiz_data = {
        "id": quiz_id,
        "doc_id": doc_id,
        "chapter_id": chapter_id,
        # Owning user of the underlying document (used for analytics)
        "user_id": user_id,
        # Timestamp so we can reason about quiz history over time
        "created_at": datetime.now().isoformat(),
        "questions": verified_questions,
        # 'score' will track how many answers the learner got correct
        "score": 0,
        # Total questions in this quiz session (used for mastery calculations)
        "total_questions": len(verified_questions),
        "status": "active",
        # Stores high-level gap labels (e.g. Foundation / Application) for later aggregation
        "weaknesses": [],
        # Validation metadata
        "validation": {
            "rule_passed": len(valid_questions),
            "rule_rejected": len(rejected_rules),
            "verifier_passed": len(verified_questions),
            "verifier_rejected": len(valid_questions) - len(verified_questions),
        },
    }
    
    db = load_quizzes()
    db[quiz_id] = quiz_data
    save_quizzes(db)

    # Return questions WITHOUT correct answer/explanation to frontend
    client_questions = [
        {
            "id": idx,
            "question": q["question"],
            "options": q["options"],
            "gap_type": q.get("gap_type", "Foundation")
        } for idx, q in enumerate(verified_questions)
    ]

    return {"quiz_id": quiz_id, "questions": client_questions}


# ─── Diagnostic Quiz (PRD §9.1) ──────────────────────────────────

@router.post("/generate_diagnostic")
def generate_diagnostic(user_id: str):
    """
    PRD §9.1 — Full-spectrum assessment across all user curricula.
    Uses RAG to sample from all active documents for that user.
    """
    # 1. Fetch multi-doc context via RAG
    # Sample up to 10 chapters from across the user's library
    top_chunks = GeminiService.retrieve_context(user_id, doc_id=None, query="core concepts and fundamentals", limit=10)
    
    if not top_chunks:
        # Fallback: Just pick a document if RAG fails
        docs = load_documents_index()
        user_docs = [d for d in docs if d.get("user_id") == user_id and d.get("status") == "Active"]
        if not user_docs:
            raise HTTPException(status_code=400, detail="No active material found for diagnostic.")
        doc_id = user_docs[0]["id"]
        return generate_quiz(doc_id)

    # 2. Extract and compose context
    found_texts = []
    for chunk in top_chunks:
        d_id = chunk.get("doc_id")
        idx = chunk.get("chapter_index")
        cp = DOC_DIR / d_id / f"chunk_{idx}.txt"
        if cp.exists():
            found_texts.append(cp.read_text(encoding="utf-8"))
    
    if not found_texts:
        raise HTTPException(status_code=500, detail="Unable to retrieve diagnostic context.")
    
    context_text = "\n\n---\n\n".join(found_texts)

    # 3. Generate larger 10-question quiz (for true diagnostic coverage)
    questions = GeminiService.generate_quiz(context_text, num_questions=10)
    
    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate diagnostic questions")

    # 4. Pipeline: Validate & Verify
    valid_questions, rejected_rules = GeminiService.rule_based_validate(questions)
    verified_questions = GeminiService.verify_quiz_questions(valid_questions, context_text)

    if not verified_questions:
        raise HTTPException(status_code=500, detail="Diagnostic failed verification")

    # 5. Persist Diagnostic Session
    quiz_id = str(uuid.uuid4())
    quiz_data = {
        "id": quiz_id,
        "doc_id": "diagnostic",  # Special marker for analytic system
        "user_id": user_id,
        "created_at": datetime.now().isoformat(),
        "questions": verified_questions,
        "score": 0,
        "total_questions": len(verified_questions),
        "status": "active",
        "weaknesses": [],
        "is_diagnostic": True,
    }
    
    db = load_quizzes()
    db[quiz_id] = quiz_data
    save_quizzes(db)

    # Return to client
    client_questions = [
        {
            "id": idx,
            "question": q["question"],
            "options": q["options"],
            "gap_type": q.get("gap_type", "Foundation")
        } for idx, q in enumerate(verified_questions)
    ]

    return {"quiz_id": quiz_id, "questions": client_questions}


# ─── Answer Submission ───────────────────────────────────────────

@router.post("/{quiz_id}/submit")
def submit_answer(quiz_id: str, question_index: int, selected_option: int):
    """
    Validates a single answer and returns immediate feedback + Gap Diagnosis.
    """
    db = load_quizzes()
    if quiz_id not in db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = db[quiz_id]
    
    if question_index >= len(quiz["questions"]):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = quiz["questions"][question_index]
    is_correct = (question["correct_index"] == selected_option)

    # Update quiz statistics for mastery tracking
    if is_correct:
        # Increment the number of correct answers recorded for this quiz
        quiz["score"] = quiz.get("score", 0) + 1
    else:
        # Log a high-level weakness label for later aggregation
        gap = question.get("gap_type", "General")
        concept = question.get("concept", "")
        detail = f"{gap}: {concept}" if concept else gap
        quiz["weaknesses"].append(detail)

    # Check if this is the last question — if so, compute and persist mastery
    total_answered = quiz.get("_answered_count", 0) + 1
    quiz["_answered_count"] = total_answered

    if total_answered >= quiz["total_questions"]:
        # Quiz is complete — compute mastery and persist to documents.json (PRD §8.2)
        tq = quiz["total_questions"]
        score = quiz["score"]
        ws = quiz.get("weaknesses", [])
        fw = sum(1 for w in ws if str(w).lower() == "foundation")
        aw = sum(1 for w in ws if str(w).lower() == "application")
        ow = len(ws) - fw - aw
        ew = float(fw) + float(ow) + 1.5 * float(aw)
        mastery_pct = max(0.0, min(100.0, ((max(0.0, float(tq) - ew)) / float(tq)) * 100.0))

        _update_chapter_mastery(
            doc_id=quiz.get("doc_id", ""),
            chapter_id=quiz.get("chapter_id"),
            mastery_pct=mastery_pct,
        )
        quiz["status"] = "completed"
        quiz["completed_at"] = datetime.now().isoformat()
        quiz["final_mastery"] = round(mastery_pct, 1)

    # Persist updated quiz state (score / weaknesses) after each answer
    db[quiz_id] = quiz
    save_quizzes(db)

    return {
        "correct": is_correct,
        "correct_index": question["correct_index"],
        "explanation": question["explanation"],
        "gap_type": question.get("gap_type"),
        "question_details": question
    }


# ─── PRD §6.6 — Remediation Route ───────────────────────────────

@router.get("/{quiz_id}/remediation")
def get_remediation(quiz_id: str):
    """
    PRD §6.6 — Generates targeted remediation based on quiz weaknesses.
    Calls generate_remediation() with the weak concepts and source text.
    """
    db = load_quizzes()
    if quiz_id not in db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = db[quiz_id]
    doc_id = quiz.get("doc_id", "")
    chapter_id = quiz.get("chapter_id")
    weaknesses = quiz.get("weaknesses", [])

    if not weaknesses:
        return {
            "remediation": "No specific weaknesses detected. Your understanding appears solid!",
            "weak_concepts": [],
            "gap_type": "none",
        }

    # Determine dominant gap type
    foundation_count = sum(1 for w in weaknesses if str(w).lower().startswith("foundation"))
    application_count = sum(1 for w in weaknesses if str(w).lower().startswith("application"))
    dominant_gap = "Application" if application_count >= foundation_count else "Foundation"

    # Extract weak concepts from incorrect answers
    weak_concepts = []
    for q in quiz.get("questions", []):
        gap = q.get("gap_type", "").lower()
        if gap == dominant_gap.lower():
            # Use the question text as a concept identifier
            weak_concepts.append(q.get("question", "")[:100])
    
    if not weak_concepts:
        weak_concepts = [f"General {dominant_gap} concepts"]

    # Load source text for context
    doc_path = DOC_DIR / doc_id
    text_source = doc_path / "raw.txt"
    if chapter_id:
        chunk_path = doc_path / f"chunk_{chapter_id}.txt"
        if chunk_path.exists():
            text_source = chunk_path

    context_text = ""
    if text_source.exists():
        context_text = text_source.read_text(encoding="utf-8")

    # Call remediation generator
    remediation_text = GeminiService.generate_remediation(
        weak_concepts=weak_concepts[:5],
        gap_type=dominant_gap,
        context=context_text,
    )

    return {
        "remediation": remediation_text,
        "weak_concepts": weak_concepts[:5],
        "gap_type": dominant_gap,
        "quiz_score": quiz.get("score", 0),
        "quiz_total": quiz.get("total_questions", 0),
        "weaknesses_summary": {
            "foundation": foundation_count,
            "application": application_count,
        },
    }


# ─── PRD §6.7 — Reassessment Route ─────────────────────────────

@router.post("/{quiz_id}/reassess")
def trigger_reassessment(quiz_id: str):
    """
    PRD §6.7 — Generates a follow-up quiz scoped to weak chapters only.
    After remediation, the user can trigger reassessment to close the loop.
    """
    db = load_quizzes()
    if quiz_id not in db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = db[quiz_id]
    doc_id = quiz.get("doc_id", "")
    chapter_id = quiz.get("chapter_id")
    weaknesses = quiz.get("weaknesses", [])

    if not weaknesses:
        raise HTTPException(status_code=400, detail="No weaknesses to reassess. Quiz was perfect!")

    # Use same document/chapter as original quiz
    doc_path = DOC_DIR / doc_id
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail="Document content not found")

    text_source = doc_path / "raw.txt"
    if chapter_id:
        chunk_path = doc_path / f"chunk_{chapter_id}.txt"
        if chunk_path.exists():
            text_source = chunk_path

    if not text_source.exists():
        raise HTTPException(status_code=404, detail="Source text not found")

    context_text = text_source.read_text(encoding="utf-8")

    # Resolve user_id
    user_id = ""
    docs = load_documents_index()
    for doc in docs:
        if doc.get("id") == doc_id:
            user_id = doc.get("user_id", "")
            break

    # Generate new quiz focused on weak areas
    questions = GeminiService.generate_quiz(context_text, num_questions=5)
    
    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate reassessment questions")

    # Run through validation pipeline
    valid_questions, rejected_rules = GeminiService.rule_based_validate(questions)
    if not valid_questions:
        raise HTTPException(status_code=500, detail="Reassessment questions failed validation")

    verified_questions = GeminiService.verify_quiz_questions(valid_questions, context_text)
    if not verified_questions:
        raise HTTPException(status_code=500, detail="Reassessment questions failed verification")

    # Create new quiz session linked to the original
    new_quiz_id = str(uuid.uuid4())
    new_quiz = {
        "id": new_quiz_id,
        "doc_id": doc_id,
        "chapter_id": chapter_id,
        "user_id": user_id,
        "created_at": datetime.now().isoformat(),
        "questions": verified_questions,
        "score": 0,
        "total_questions": len(verified_questions),
        "status": "active",
        "weaknesses": [],
        "reassessment_of": quiz_id,  # Link to original quiz
        "validation": {
            "rule_passed": len(valid_questions),
            "rule_rejected": len(rejected_rules),
            "verifier_passed": len(verified_questions),
            "verifier_rejected": len(valid_questions) - len(verified_questions),
        },
    }

    db[new_quiz_id] = new_quiz
    save_quizzes(db)

    # Return questions WITHOUT correct answer/explanation to frontend
    client_questions = [
        {
            "id": idx,
            "question": q["question"],
            "options": q["options"],
            "gap_type": q.get("gap_type", "Foundation")
        } for idx, q in enumerate(verified_questions)
    ]

    return {"quiz_id": new_quiz_id, "questions": client_questions, "reassessment_of": quiz_id}


# ─── PRD §12.3 — Flag Question (Human-in-the-loop) ──────────────

from pydantic import BaseModel
from typing import Optional

class FlagRequest(BaseModel):
    question_index: int
    error_type: str # hallucination | off-topic | factual_error
    note: Optional[str] = None

@router.post("/{quiz_id}/flag")
def flag_question(quiz_id: str, payload: FlagRequest):
    """
    Implements PRD §13.2 & §12.3: Categorize and log AI errors.
    """
    db = load_quizzes()
    if quiz_id not in db:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    quiz = db[quiz_id]
    if payload.question_index >= len(quiz["questions"]):
        raise HTTPException(status_code=400, detail="Invalid question index")

    question = quiz["questions"][payload.question_index]
    
    from services.error_logger import log_system_error
    log_system_error(
        error_type=payload.error_type,
        model_used="gemini-current", # We can refine this later
        prompt="[User Flagged Question]",
        offending_content={
            "question": question,
            "user_note": payload.note
        },
        metadata={
            "quiz_id": quiz_id,
            "doc_id": quiz.get("doc_id"),
            "user_id": quiz.get("user_id")
        }
    )

    return {"status": "logged", "message": f"Error of type '{payload.error_type}' recorded."}
