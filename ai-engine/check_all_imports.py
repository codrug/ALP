print("Checking imports...")
try:
    from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
    print("fastapi: OK")
    import uvicorn
    print("uvicorn: OK")
    from pydantic import BaseModel
    print("pydantic: OK")
    from dotenv import load_dotenv
    print("dotenv: OK")
    from qdrant_client import QdrantClient
    print("qdrant_client: OK")
    from google import genai
    print("google-genai: OK")
    import pdfplumber
    print("pdfplumber: OK")
    import docx
    print("python-docx: OK")
    print("All critical imports for AI engine are OK.")
except Exception as e:
    print(f"FAILED import: {e}")
    import traceback
    traceback.print_exc()
