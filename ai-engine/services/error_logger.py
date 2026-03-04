import json
import os
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

DATA_DIR = Path("data")
ERROR_LOG_FILE = DATA_DIR / "error_log.json"

def get_prompt_hash(prompt: str) -> str:
    """Generates a stable hash for a prompt to track performance over time."""
    return hashlib.sha256(prompt.encode('utf-8')).hexdigest()

def log_system_error(
    error_type: str, 
    model_used: str, 
    prompt: str, 
    offending_content: Any,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Implements PRD §13.2: Categorize error types 
    (hallucination, off-topic, factual_error, model_used, prompt_hash).
    """
    if not DATA_DIR.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "error_type": error_type, # hallucination | off-topic | factual_error | parse_failure
        "model_used": model_used,
        "prompt_hash": get_prompt_hash(prompt),
        "content_snapshot": offending_content,
        "used_for_optimization": False, # PRD §13.3: Never use errors as content
        "metadata": metadata or {}
    }

    current_logs = []
    if ERROR_LOG_FILE.exists():
        try:
            with open(ERROR_LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    current_logs = data
                elif isinstance(data, dict) and "errors" in data:
                    current_logs = data["errors"]
        except (json.JSONDecodeError, IOError):
            current_logs = []

    current_logs.append(log_entry)

    with open(ERROR_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump({"errors": current_logs}, f, indent=4)

    return log_entry["id"]
