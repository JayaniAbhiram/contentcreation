from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
models = client.models.list()
for m in models:
    if 'generate_images' in dir(m) or 'image' in m.name.lower():
        print(f"Model: {m.name}, Supported Methods: {m.supported_generation_methods}")
