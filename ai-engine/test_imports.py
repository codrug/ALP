try:
    from google import genai
    print("Success: from google import genai")
except ImportError as e:
    print(f"Error: {e}")

try:
    import google.generativeai as gai
    print("Success: import google.generativeai")
except ImportError as e:
    print(f"Error: {e}")
