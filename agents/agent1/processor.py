from datetime import datetime
import dateparser
import json
import re
from .reminder_detector import detect_reminder

def clean_json(text: str):
    text = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    raise ValueError("Invalid JSON")


def normalize_output(data: dict):
    # default date = today
    if not data.get("date"):
        data["date"] = datetime.now().strftime("%Y-%m-%d")

    else:
        parsed_date = dateparser.parse(data["date"])
        if parsed_date:
            data["date"] = parsed_date.strftime("%Y-%m-%d")

    # normalize time (8PM → 20:00)
    if data.get("time"):
        parsed_time = dateparser.parse(data["time"])
        if parsed_time:
            data["time"] = parsed_time.strftime("%H:%M")

    return data

def process_text(text: str):
    result = detect_reminder(text)
    try:
        parsed = clean_json(result)
        return normalize_output(parsed)

    except Exception:
        return {
            "error": "Parsing failed",
            "raw_output": result
        }