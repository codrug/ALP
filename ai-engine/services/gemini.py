from google import genai
from google.genai import types
import os
import json
import logging
from typing import List, Dict
from fastembed import TextEmbedding

logger = logging.getLogger("alp")

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
client = None

if not api_key:
    logger.warning("GOOGLE_API_KEY not found. AI features will fail.")
else:
    client = genai.Client(api_key=api_key.strip())

# Initialize FastEmbed model (Local CPU embeddings)
# BAAI/bge-base-en-v1.5 produces 768-dimensional vectors
try:
    embedding_model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
    logger.info("FastEmbed local model initialized (768 dims).")
except Exception as e:
    logger.error(f"Failed to initialize FastEmbed: {e}")
    embedding_model = None

# Robust model fallback list
MODELS_FALLBACK = [
    "gemini-flash-latest",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-pro-latest"
]

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

        Return strictly a JSON list of objects:
        [
            {{
                "question": "Question text here...",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_index": 0,
                "explanation": "Why the answer is correct.",
                "gap_type": "Foundation"
            }}
        ]

        Text:
        "{context_text[:25000]}" 
        """

        last_exception = None
        for model_id in MODELS_FALLBACK:
            try:
                logger.info(f"Attempting quiz generation with {model_id}...")
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
                    raise je

            except Exception as e:
                last_exception = e
                error_msg = str(e).upper()
                if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg or "NOT_FOUND" in error_msg or "404" in error_msg:
                    logger.warning(f"Model {model_id} failed with {e}. Trying fallback...")
                    continue
                else:
                    logger.error(f"Gemini Quiz Generation Failed on {model_id}: {e}")
                    continue

        logger.error(f"All Gemini models failed. Last error: {last_exception}")
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
                if "RESOURCE_EXHAUSTED" in error_msg or "429" in error_msg or "NOT_FOUND" in error_msg or "404" in error_msg:
                    continue
                else:
                    break
        
        logger.error(f"All Gemini remediation models failed. Last error: {last_exception}")
        return "Unable to generate remediation at this time."

    @staticmethod
    def generate_embeddings(texts: List[str]) -> List[List[float]]:
        """
        Generates embeddings locally using FastEmbed (BAAI/bge-base-en-v1.5).
        Bypasses Gemini API limits and 404 errors.
        """
        if not embedding_model:
            logger.error("FastEmbed model not initialized.")
            return [[0.0] * 768 for _ in texts]

        try:
            # zip results back into a list of floats
            # FastEmbed's embed returns a generator of numpy arrays
            embeddings_generator = embedding_model.embed(texts)
            return [emb.tolist() for emb in embeddings_generator]
        except Exception as e:
            logger.error(f"Local embedding generation failed: {e}")
            return [[0.0] * 768 for _ in texts]
