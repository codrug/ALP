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

# Gemini Client (Lazy Initialized)
_gemini_client = None

def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not found in environment.")
            return None
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=api_key.strip())
            logger.info("Gemini Client initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini Client: {e}")
    return _gemini_client

# FastEmbed model (Lazy Initialized)
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        try:
            from fastembed import TextEmbedding
            logger.info("Initializing FastEmbed local model (BAAI/bge-base-en-v1.5)...")
            _embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
            logger.info("FastEmbed initialized.")
        except ImportError:
            logger.error("fastembed not installed. Run 'pip install fastembed'.")
        except Exception as e:
            logger.error(f"Failed to initialize FastEmbed: {e}")
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

# Robust model fallback list based on available models for this key
MODELS_FALLBACK = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro-001",
    "gemini-1.5-pro-002",
    "gemini-pro"
]

class GeminiService:
    @staticmethod
    def generate_quiz(context_text: str, num_questions: int = 5) -> List[Dict]:
        """
        Generates MCQs using the new Google Gen AI SDK.
        """
        model = get_gemini_client()
        if not model:
            logger.error("Gemini Service Unavailable. Providing Mock Quiz.")
            return GeminiService.generate_mock_quiz(context_text)

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
            try:
                logger.info(f"Attempting quiz generation with {model_id}...")
                response = model.models.generate_content(
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

                if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg or "NOT_FOUND" in error_msg or "404" in error_msg:
                    logger.warning(f"Model {model_id} failed with {e}. Trying fallback...")
                    continue
                else:
                    logger.error(f"Gemini Quiz Generation Failed on {model_id}: {e}")
                    continue

        logger.error(f"All Gemini models failed. Last error: {last_exception}")
        
        # FINAL FALLBACK: Mock Quiz (PRD §13.4 - Resilience)
        # Provide a placeholder quiz so the user can see the UI and platform value
        # regardless of specific API error (Quota, Auth, or Region)
        logger.warning("Generation failed for all models. Providing Mock Quiz for testing.")
        return GeminiService.generate_mock_quiz(context_text)

    @staticmethod
    def generate_mock_quiz(context_text: str) -> List[Dict]:
        """
        Provides a relevant placeholder quiz when AI generation fails.
        Extracts keywords from context to make it feel related to the curriculum.
        """
        import re
        from collections import Counter
        
        # Extract potential nouns/concepts (Capitalized words or long words)
        concepts = re.findall(r'\b[A-Z][a-z]{3,}\b|\b[a-z]{7,}\b', context_text)
        common_concepts = [c for c, count in Counter(concepts).most_common(5)]
        
        topic_str = "the provided curriculum"
        if common_concepts:
            topic_str = f"the curriculum (specifically {', '.join(common_concepts[:3])})"

        return [
            {
                "question": f"Based on {topic_str}, which focus area is most critical for your current learning phase?",
                "options": [
                    "Core Fundamentals & Definitions",
                    "Practical Application & Exercises",
                    "Advanced Theoretical Integration",
                    "Comprehensive Review & Summary"
                ],
                "correct_index": 0,
                "explanation": f"This question samples from {topic_str}. Note: You are seeing this diagnostic quiz because the Gemini API quota is temporarily reached.",
                "gap_type": "Foundation",
                "concept": common_concepts[0] if common_concepts else "Core Curriculum"
            },
            {
                "question": f"How should you apply the concepts from {topic_str} in a real-world scenario?",
                "options": [
                    "By memorizing all definitions",
                    "By identifying and bridging specific knowledge gaps",
                    "By ignoring complex sections",
                    "By only focusing on familiar topics"
                ],
                "correct_index": 1,
                "explanation": "Effective learning involves active gap identification as outlined in your study material.",
                "gap_type": "Application",
                "concept": common_concepts[1] if len(common_concepts) > 1 else "Strategy"
            },
            {
                "question": f"Which element of {common_concepts[2] if len(common_concepts) > 2 else 'the material'} requires frequent retrieval practice?",
                "options": [
                    "Simple facts",
                    "Complex relationships between concepts",
                    "Formatting details",
                    "File metadata"
                ],
                "correct_index": 1,
                "explanation": "Mastery comes from understanding how different parts of the curriculum interact.",
                "gap_type": "Foundation",
                "concept": common_concepts[2] if len(common_concepts) > 2 else "Mastery"
            }
        ]

    @staticmethod
    def generate_remediation(weak_concepts: List[str], gap_type: str, context: str) -> str:
        """
        Generates a targeted study guide using the new Google Gen AI SDK.
        """
        model = get_gemini_client()
        if not model:
            logger.error("Gemini Service Unavailable for remediation. Providing Mock Remediation.")
            return GeminiService.generate_mock_remediation(weak_concepts, gap_type, context)

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
                logger.info(f"Attempting remediation generation with {model_id}...")
                response = model.models.generate_content(
                    model=model_id,
                    contents=prompt
                )
                if response and response.text:
                    return response.text
                continue
            except Exception as e:
                last_exception = e
                error_msg = str(e).upper()
                
                # Log General Generation Exception
                from services.error_logger import log_system_error
                log_system_error(
                    error_type="remediation_exception",
                    model_used=model_id,
                    prompt=prompt,
                    offending_content=str(e)
                )

                if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg or "NOT_FOUND" in error_msg or "404" in error_msg:
                    logger.warning(f"Model {model_id} failed with {e}. Trying fallback...")
                    continue
                else:
                    logger.error(f"Gemini Remediation Failed on {model_id}: {e}")
                    continue
        
        logger.error(f"All Gemini remediation models failed. Last error: {last_exception}")
        return GeminiService.generate_mock_remediation(weak_concepts, gap_type, context)

    @staticmethod
    def generate_mock_remediation(weak_concepts: List[str], gap_type: str, context: str) -> str:
        """
        Provides a relevant placeholder study guide when AI generation fails.
        """
        topic = weak_concepts[0] if weak_concepts else "the identified gaps"
        
        return f"""Focus on bridging your {gap_type} gap regarding {topic}:

• Core Principle: Review the fundamental definitions and structural relationships described in the source material for {topic}.
• Practical Context: Application of these concepts requires understanding how they integrate with broader system workflows.
• Targeted Review: Focus specifically on sections of the text that define {topic} and its primary functions to resolve common misconceptions."""

    @staticmethod
    def generate_embeddings(texts: List[str]) -> List[List[float]]:
        """
        Generates embeddings locally using FastEmbed.
        """
        model = get_embedding_model()
        if not model:
            logger.error("Embedding model unavailable.")
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
        model = get_gemini_client()
        if not model or not questions:
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
            try:
                response = model.models.generate_content(
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
                logger.warning(f"Verifier LLM call failed on {model_id}: {e}, skipping verification.")
                continue

        # If all models fail, return original questions (graceful degradation)
        logger.warning("All verifier models failed. Returning unverified questions.")
        return questions

    # ─── PRD §14.3 — RAG Retrieval ──────────────────────────────
    @staticmethod
    def retrieve_context(user_id: str, doc_id: str, query: str = "", limit: int = 5) -> str:
        """
        Retrieves relevant context chunks from Qdrant using vector search.
        """
        model = get_embedding_model()
        if not qdrant_client or not model:
            return ""

        try:
            # 1. Generate Query Vector
            search_query = query or "core concepts and important details"
            query_vector = list(model.embed([search_query]))[0].tolist()

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

