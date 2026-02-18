from google import genai
from google.genai import types
import os
import json
import logging
from typing import List, Dict

logger = logging.getLogger("alp")

# Initialize the Client
# The new SDK automatically looks for GEMINI_API_KEY or GOOGLE_API_KEY.
# We explicitly pass it to be safe.
api_key = os.getenv("GOOGLE_API_KEY")
client = None

if not api_key:
    logger.warning("GOOGLE_API_KEY not found. AI features will fail.")
else:
    client = genai.Client(api_key=api_key)

# Use the model you requested
MODEL_ID = "gemini-3-flash-preview"


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

        try:
            # New SDK call format
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"  # Forces JSON output
                )
            )

            # Parse the JSON response
            clean_text = response.text.strip()
            return json.loads(clean_text)

        except Exception as e:
            logger.error(f"Gemini Quiz Generation Failed: {e}")
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
        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=prompt
            )
            return response.text
        except Exception as e:
            logger.error(f"Remediation Failed: {e}")
            return "Unable to generate remediation at this time."