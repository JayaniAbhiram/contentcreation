import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
print(f"genai version: {genai.__version__}")
print(f"Attributes: {dir(genai)}")
