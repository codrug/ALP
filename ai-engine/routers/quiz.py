from fastapi import APIRouter, HTTPException
from pathlib import Path
from datetime import datetime
import json
import uuid
import os
from services.gemini import GeminiService

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

@router.post("/generate/{doc_id}")
def generate_quiz(doc_id: str, chapter_id: str = None):
    """
    Triggers Gemini to generate a quiz from the document's text.
    """
    # 1. Fetch Document Text
    doc_path = DOC_DIR / doc_id
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail="Document content not found")

    # If chapter_id is provided, try to load specific chunk, else load raw.txt
    text_source = doc_path / "raw.txt"
    if chapter_id:
        chunk_path = doc_path / f"chunk_{chapter_id}.txt"
        if chunk_path.exists():
            text_source = chunk_path

    if not text_source.exists():
        raise HTTPException(status_code=404, detail="Source text not found")

    context_text = text_source.read_text(encoding="utf-8")

    # 1b. Resolve the owning user for this document (if available)
    user_id = ""
    docs = load_documents_index()
    for doc in docs:
        if doc.get("id") == doc_id:
            user_id = doc.get("user_id", "")
            break

    # 2. Call Gemini Service
    questions = GeminiService.generate_quiz(context_text)
    
    if not questions:
        raise HTTPException(status_code=500, detail="AI failed to generate questions")

    # 3. Save Quiz Session
    quiz_id = str(uuid.uuid4())
    
    # [ROBUSTNESS] Validate that 'questions' is a list and has at least one valid question
    if not isinstance(questions, list) or len(questions) == 0:
        raise HTTPException(status_code=500, detail="AI returned empty or invalid question set")

    # Filter out questions with missing required keys to prevent KeyError
    valid_questions = []
    required_keys = {"question", "options", "correct_index", "explanation"}
    for q in questions:
        if all(key in q for key in required_keys):
            valid_questions.append(q)
    
    if not valid_questions:
        raise HTTPException(status_code=500, detail="AI response was missing required fields")

    quiz_data = {
        "id": quiz_id,
        "doc_id": doc_id,
        "chapter_id": chapter_id,
        # Owning user of the underlying document (used for analytics)
        "user_id": user_id,
        # Timestamp so we can reason about quiz history over time
        "created_at": datetime.now().isoformat(),
        "questions": valid_questions,
        # 'score' will track how many answers the learner got correct
        "score": 0,
        # Total questions in this quiz session (used for mastery calculations)
        "total_questions": len(valid_questions),
        "status": "active",
        # Stores high-level gap labels (e.g. Foundation / Application) for later aggregation
        "weaknesses": [],
    }
    
    db = load_quizzes()
    db[quiz_id] = quiz_data
    save_quizzes(db)

    # Return questions WITHOUT correct answer/explanation to frontend
    client_questions = [
        {
            "id": idx,
            "question": q["question"],
            "options": q["options"]
        } for idx, q in enumerate(valid_questions)
    ]

    return {"quiz_id": quiz_id, "questions": client_questions}

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
        quiz["weaknesses"].append(question.get("gap_type", "General"))

    # Persist updated quiz state (score / weaknesses) after each answer
    db[quiz_id] = quiz
    save_quizzes(db)

    return {
        "correct": is_correct,
        "correct_index": question["correct_index"],
        "explanation": question["explanation"],
        "gap_type": question.get("gap_type") if not is_correct else None
    }