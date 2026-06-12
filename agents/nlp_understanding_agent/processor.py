from datetime import datetime
import dateparser
import json
import re
from .reminder_detector import detect_reminder
from agents.context_detection_agent.context import ContextAgent

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
    if data.get("raw_time"):
        data["notification_time"] = resolve_notification_time(data["raw_time"])
        parsed_time = dateparser.parse(data["raw_time"])
        if parsed_time:
            data["time"] = parsed_time.strftime("%H:%M")

    return data

def resolve_notification_time(raw_time: str):
    normalized = raw_time.lower().strip()
    default_times = {
        "morning": "09:00",
        "afternoon": "13:00",
        "after noon": "13:00",
        "evening": "18:00",
        "night": "21:00",
        "tonight": "21:00",
        "noon": "12:00",
    }

    if normalized in default_times:
        return default_times[normalized]

    parsed_time = dateparser.parse(raw_time)
    if parsed_time:
        return parsed_time.strftime("%H:%M")

    return ""

def process_text(text: str):
    result = detect_reminder(text)
    try:
        parsed = clean_json(result)
        normalized = normalize_output(parsed)
        print("\n******AGENT-1 OUTPUT*******")
        print(normalized)
        context_agent = ContextAgent()
        enriched = context_agent.process(normalized)
        print("\n******AGENT-2 OUTPUT*******")
        print(enriched)
        return enriched

    except Exception:
        return {
            "error": "Parsing failed",
            "raw_output": result
        }
