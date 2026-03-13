from google import genai
from google.genai import types
import os
import json
import logging
from typing import List, Dict, Optional
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models

logger = logging.getLogger("alp")

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
client = None

if not api_key:
    logger.warning("GOOGLE_API_KEY not found. AI features will fail.")
else:
    client = genai.Client(api_key=api_key.strip())

# Global embedding model (lazy-initialized)
_embedding_model = None

def get_embedding_model():
    """Lazy-initializes the FastEmbed model to keep startup fast."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from fastembed import TextEmbedding
            # BAAI/bge-base-en-v1.5 produces 768-dimensional vectors
            _embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
            logger.info("FastEmbed local model initialized (768 dims).")
        except Exception as e:
            logger.error(f"Failed to initialize FastEmbed: {e}")
            _embedding_model = None
    return _embedding_model

# Initialize Qdrant Client for RAG
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "alp_chunks")

qdrant_client = None
if QDRANT_URL and QDRANT_API_KEY:
    try:
        qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        logger.info("Qdrant client initialized for RAG in GeminiService.")
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant in GeminiService: {e}")

# Robust model fallback list
MODELS_FALLBACK = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-pro-exp-02-05", # Experimental Pro
    "gemini-exp-1206",           # General experimental
    "gemini-pro-latest"
]

import time
import random

class GeminiService:
    @staticmethod
    def generate_quiz(context_text: str, num_questions: int = 5) -> List[Dict]:
        """
        Generates MCQs using the new Google Gen AI SDK.
        """
        if not client:
            logger.error("Client not initialized. Check API Key.")
            return []

        # We ask for a JSON array of questions
        prompt = f"""
        You are an expert exam setter. Based ONLY on the following text, generate {num_questions} multiple-choice questions.

        For each question, assign a "gap_type":
        - "Foundation": Tests basic facts, definitions, or recall.
        - "Application": Tests reasoning, problem-solving, or connecting concepts.

        Return strictly a JSON list of objects. Keep each explanation under 2 sentences.
        [
            {{
                "question": "Question text here...",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_index": 0,
                "explanation": "concise explanation here...",
                "gap_type": "Foundation",
                "concept": "Specific concept name (e.g. Memory Allocation, TCP Handshake)"
            }}
        ]

        Text:
        "{context_text[:25000]}" 
        """

        last_exception = None
        for model_id in MODELS_FALLBACK:
            for attempt in range(2): # Retry each model once with a delay
                try:
                    logger.info(f"Attempting quiz generation with {model_id} (Attempt {attempt+1})...")
                    response = client.models.generate_content(
                        model=model_id,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )

                    if not response or not response.text:
                        continue
                        
                    clean_text = response.text.strip()
                    
                    try:
                        return json.loads(clean_text)
                    except json.JSONDecodeError as je:
                        if "```json" in clean_text:
                            extracted = clean_text.split("```json")[-1].split("```")[0].strip()
                            return json.loads(extracted)
                        
                        # Log Parse Failure as per PRD §13.2
                        from services.error_logger import log_system_error
                        log_system_error(
                            error_type="parse_failure",
                            model_used=model_id,
                            prompt=prompt,
                            offending_content=clean_text
                        )
                        raise je

                except Exception as e:
                    last_exception = e
                    error_msg = str(e).upper()
                    
                    # Log General Generation Exception
                    from services.error_logger import log_system_error
                    log_system_error(
                        error_type="generation_exception",
                        model_used=model_id,
                        prompt=prompt,
                        offending_content=str(e)
                    )

                    if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
                        if "PERDAY" in error_msg:
                            logger.error(f"Daily quota exhausted for {model_id} (API Key: {api_key[:8]}...). Trying next model...")
                            break # Try next model immediately
                        
                        if attempt == 0:
                            wait_time = 5 + random.uniform(1, 3)
                            logger.warning(f"Rate limited (RPM) on {model_id}. Waiting {wait_time:.1f}s before retry...")
                            time.sleep(wait_time)
                            continue # Same model, retry
                        else:
                            logger.warning(f"Model {model_id} still rate limited after retry. Trying fallback...")
                            break # Try next model
                    
                    if "NOT_FOUND" in error_msg or "404" in error_msg:
                        logger.warning(f"Model {model_id} not available. Trying fallback...")
                        break
                    
                    logger.error(f"Gemini Quiz Generation Exception on {model_id}: {e}")
                    break # Non-quota error, move to next model

        logger.error(f"All Gemini models failed. Root cause found: Your API key ({api_key[:8]}...) has likely hit its limit (429 Resource Exhausted / Quota). Please rotate your GEMINI_API_KEY in .env.")
        return []

    @staticmethod
    def generate_remediation(weak_concepts: List[str], gap_type: str, context: str) -> str:
        """
        Generates a targeted study guide using the new Google Gen AI SDK.
        """
        if not client:
            return "AI Service Unavailable."

        prompt = f"""
        The student has a '{gap_type}' gap in these concepts: {", ".join(weak_concepts)}.

        Using the source text below, provide a strictly simplified, 3-bullet point explanation to fix this specific gap.
        Do not use general advice. Explain the specific concepts they missed.

        Source Text:
        "{context[:5000]}"
        """
        last_exception = None
        for model_id in MODELS_FALLBACK:
            try:
                response = client.models.generate_content(
                    model=model_id,
                    contents=prompt
                )
                return response.text
            except Exception as e:
                last_exception = e
                error_msg = str(e).upper()
                if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg:
                    if "PERDAY" in error_msg: break
                    time.sleep(3)
                    continue
                break # Non-quota error
        
        logger.error(f"All Gemini remediation models failed. Last error: {last_exception}")
        return "Unable to generate remediation at this time."

    @staticmethod
    def generate_embeddings(texts: List[str]) -> List[List[float]]:
        """
        Generates embeddings locally using FastEmbed (BAAI/bge-base-en-v1.5).
        Bypasses Gemini API limits and 404 errors.
        """
        model = get_embedding_model()
        if not model:
            logger.error("FastEmbed model not initialized.")
            return [[0.0] * 768 for _ in texts]

        try:
            # zip results back into a list of floats
            # FastEmbed's embed returns a generator of numpy arrays
            embeddings_generator = model.embed(texts)
            return [emb.tolist() for emb in embeddings_generator]
        except Exception as e:
            logger.error(f"Local embedding generation failed: {e}")
            return [[0.0] * 768 for _ in texts]

    # ─── PRD §12 — Validation Pipeline ───────────────────────────
    @staticmethod
    def rule_based_validate(questions: List[Dict]) -> tuple[List[Dict], List[Dict]]:
        """
        PRD §12.1 — Rule-based checks on LLM quiz output.
        Returns (valid, rejected) question lists.
        """
        valid = []
        rejected = []
        for q in questions:
            # Must have all required keys
            required_keys = {"question", "options", "correct_index", "explanation", "concept"}
            if not all(k in q for k in required_keys):
                rejected.append({"question": q, "reason": "missing_required_keys"})
                continue
            # Must have exactly 4 options
            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                rejected.append({"question": q, "reason": "options_not_4"})
                continue
            # correct_index must be 0-3
            ci = q["correct_index"]
            if not isinstance(ci, int) or ci < 0 or ci > 3:
                rejected.append({"question": q, "reason": "invalid_correct_index"})
                continue
            # No empty question text
            if not q["question"].strip():
                rejected.append({"question": q, "reason": "empty_question"})
                continue
            # No empty options
            if any(not str(o).strip() for o in q["options"]):
                rejected.append({"question": q, "reason": "empty_option"})
                continue
            # Options must be unique (case-insensitive)
            lower_opts = [str(o).strip().lower() for o in q["options"]]
            if len(set(lower_opts)) != 4:
                rejected.append({"question": q, "reason": "duplicate_options"})
                continue
            # Question length guard: too short or too long
            if len(q["question"]) < 10 or len(q["question"]) > 2000:
                rejected.append({"question": q, "reason": "question_length_out_of_range"})
                continue
            valid.append(q)
        return valid, rejected

    @staticmethod
    def verify_quiz_questions(questions: List[Dict], source_text: str) -> List[Dict]:
        """
        Verifier LLM validation.
        Uses a second Gemini call to cross-check generated Q&A against source text.
        Returns only verified questions.
        """
        if not client or not questions:
            return questions  # Graceful fallback: skip verification if client unavailable

        # Build a compact payload for the verifier
        qa_payload = []
        for i, q in enumerate(questions):
            qa_payload.append({
                "index": i,
                "question": q["question"],
                "correct_answer": q["options"][q["correct_index"]],
                "explanation": q.get("explanation", ""),
            })

        prompt = f"""You are a strict academic verifier. Given the SOURCE TEXT and a list of QUESTIONS with their stated CORRECT ANSWERS, verify each question:

1. Is the correct answer actually correct according to the source text?
2. Is the question grounded in the source text (not hallucinated)?
3. Is the explanation accurate?

Return a JSON array of objects, one per question:
[{{"index": 0, "verdict": "PASS"}}, {{"index": 1, "verdict": "FAIL", "reason": "The correct answer is wrong because..."}}]

Only return PASS or FAIL. Be strict but fair.

SOURCE TEXT (truncated):
\"{source_text[:8000]}\"

QUESTIONS TO VERIFY:
{json.dumps(qa_payload, indent=2)}
"""
        for model_id in MODELS_FALLBACK:
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=model_id,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )
                    if not response or not response.text:
                        continue

                    verdicts = json.loads(response.text.strip())
                    if not isinstance(verdicts, list):
                        continue

                    # Build a set of indices that passed verification
                    passed_indices = set()
                    for v in verdicts:
                        if isinstance(v, dict) and v.get("verdict", "").upper() == "PASS":
                            passed_indices.add(v.get("index"))

                    verified = []
                    for i, q in enumerate(questions):
                        if i in passed_indices:
                            verified.append(q)
                        else:
                            # Log the rejection for error learning (PRD §13)
                            reason = "unknown"
                            for v in verdicts:
                                if isinstance(v, dict) and v.get("index") == i:
                                    reason = v.get("reason", "verifier_rejected")
                                    break
                            from services.error_logger import log_system_error
                            log_system_error(
                                error_type="verifier_rejected",
                                model_used=model_id,
                                prompt="[Verifier LLM Check]",
                                offending_content={
                                    "question": q.get("question"),
                                    "stated_correct": q["options"][q["correct_index"]],
                                    "reason": reason,
                                }
                            )
                            logger.info(f"Verifier rejected Q{i}: {reason}")

                    # If ALL questions were rejected, fall back to returning them anyway
                    # (avoid empty quiz) but log a warning
                    if not verified:
                        logger.warning("Verifier rejected ALL questions. Returning unverified set.")
                        return questions

                    return verified

                except Exception as e:
                    error_msg = str(e).upper()
                    if ("RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg) and attempt == 0:
                        time.sleep(2)
                        continue
                    logger.warning(f"Verifier LLM call failed on {model_id}: {e}, skipping verification.")
                    break # Try next model

        # If all models fail, return original questions (graceful degradation)
        logger.warning("All verifier models failed. Returning unverified questions.")
        return questions

    # ─── PRD §14.3 — RAG Retrieval ──────────────────────────────
    @staticmethod
    def retrieve_context(user_id: str, doc_id: str, query: str = "", limit: int = 5) -> str:
        """
        Retrieves relevant context chunks from Qdrant using vector search.
        Falls back to empty string if Qdrant is unavailable.
        """
        if not qdrant_client or not embedding_model:
            return ""

        try:
            # 1. Generate Query Vector
            # Use 'query' (e.g. topic) if provided, else broad representative search
            search_query = query or "core concepts and important details"
            query_vector = list(embedding_model.embed([search_query]))[0].tolist()

            # 2. Build Filter
            must_selectors = [
                qdrant_models.FieldCondition(
                    key="user_id",
                    match=qdrant_models.MatchValue(value=user_id)
                )
            ]
            if doc_id:
                must_selectors.append(
                    qdrant_models.FieldCondition(
                        key="doc_id",
                        match=qdrant_models.MatchValue(value=doc_id)
                    )
                )

            # 3. Search Qdrant
            results = qdrant_client.search(
                collection_name=QDRANT_COLLECTION,
                query_vector=query_vector,
                query_filter=qdrant_models.Filter(must=must_selectors),
                limit=limit
            )

            if not results:
                return ""

            # 4. Return pairs of (doc_id, chapter_index) to allow multi-doc retrieval
            return [
                {
                    "doc_id": r.payload.get("doc_id"),
                    "chapter_index": r.payload.get("chapter_index")
                }
                for r in results if r.payload and "doc_id" in r.payload
            ]

        except Exception as e:
            logger.error(f"RAG Retrieval failed: {e}")
            return []

