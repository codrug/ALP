# ai-engine/routers/quiz.py
from fastapi import APIRouter, HTTPException
from pathlib import Path
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

def load_quizzes():
    if not QUIZ_FILE.exists():
        return {}
    with open(QUIZ_FILE, "r") as f:
        return json.load(f)

def save_quizzes(data):
    with open(QUIZ_FILE, "w") as f:
        json.dump(data, f, indent=2)

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
        "questions": valid_questions,
        "score": 0,
        "status": "active",
        "weaknesses": [] 
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

    # Log weakness if wrong
    if not is_correct:
        quiz["weaknesses"].append(question.get("gap_type", "General"))
        save_quizzes(db)

    return {
        "correct": is_correct,
        "correct_index": question["correct_index"],
        "explanation": question["explanation"],
        "gap_type": question.get("gap_type") if not is_correct else None
    }