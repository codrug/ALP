
from google import genai
import os
from dotenv import load_dotenv

# Load env from root
load_dotenv('.env')

def test_key(key_name):
    api_key = os.getenv(key_name)
    if not api_key:
        print(f"[{key_name}] Not found")
        return
    
    # Strip potential whitespace from .env
    api_key = api_key.strip()
    
    print(f"[{key_name}] Testing key starting with {api_key[:8]}...")
    try:
        client = genai.Client(api_key=api_key)
        for m in client.models.list():
            print(f" - {m.name}")
    except Exception as e:
        print(f"[{key_name}] FAILED: {e}")

print("--- AI Engine API Diagnostic ---")
test_key("GOOGLE_API_KEY")
print("\n---")
test_key("GEMINI_API_KEY")
