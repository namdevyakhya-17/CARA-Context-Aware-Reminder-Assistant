import google.generativeai as genai
from utils.config import API_KEY
from utils.prompts import EXTRACTION_PROMPT

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("models/gemini-2.5-flash")

def detect_reminder(text: str):
    prompt = EXTRACTION_PROMPT.format(text=text)
    response = model.generate_content(prompt)
    return response.text