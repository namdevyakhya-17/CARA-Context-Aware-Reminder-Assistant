from datetime import datetime, time

import dateparser


HIGH_SCORE = 6
LOW_SCORE = 1

URGENCY_SIGNALS = {
    "urgent": 4,
    "asap": 4,
    "immediately": 4,
    "right away": 4,
    "important": 3,
    "critical": 4,
    "must": 2,
    "deadline": 3,
}

CONSEQUENCE_SIGNALS = {
    "submit": 2,
    "pay": 2,
    "call": 2,
    "appointment": 3,
    "medicine": 3,
    "prescription": 3,
    "hospital": 4,
    "doctor": 3,
    "interview": 3,
    "exam": 3,
    "meeting": 2,
    "fee": 2,
    "fine": 3,
    "rent": 3,
    "bill": 2,
}

OPTIONAL_SIGNALS = {
    "maybe": -2,
    "sometime": -2,
    "whenever": -2,
    "if possible": -2,
    "optional": -3,
    "watch": -1,
    "play": -1,
    "listen": -1,
}


def detect_priority(reminder):
    text, date_text, time_text = normalize_reminder_input(reminder)
    score = calculate_priority_score(text, date_text, time_text)

    if score >= HIGH_SCORE:
        return "high"
    if score <= LOW_SCORE:
        return "low"
    return "medium"


def calculate_priority_score(text, date_text="", time_text=""):
    normalized_text = str(text or "").lower()
    score = 3

    score += signal_score(normalized_text, URGENCY_SIGNALS)
    score += signal_score(normalized_text, CONSEQUENCE_SIGNALS)
    score += signal_score(normalized_text, OPTIONAL_SIGNALS)
    score += due_date_score(date_text)
    score += due_time_score(time_text)

    return score


def normalize_reminder_input(reminder):
    if isinstance(reminder, dict):
        task = reminder.get("task", "")
        date_text = reminder.get("date", "")
        time_text = (
            reminder.get("notification_time")
            or reminder.get("time")
            or reminder.get("raw_time")
            or ""
        )
        entities = reminder.get("entities", [])
        if entities:
            task = f"{task} {' '.join(map(str, entities))}"
        return task, date_text, time_text

    return str(reminder or ""), "", ""


def signal_score(text, signals):
    return sum(weight for signal, weight in signals.items() if signal in text)


def due_date_score(date_text):
    if not date_text:
        return 0

    parsed_date = dateparser.parse(str(date_text))
    if not parsed_date:
        return 0

    today = datetime.now().date()
    days_until_due = (parsed_date.date() - today).days

    if days_until_due < 0:
        return 4
    if days_until_due == 0:
        return 3
    if days_until_due == 1:
        return 2
    if days_until_due <= 3:
        return 1
    if days_until_due >= 14:
        return -1
    return 0


def due_time_score(time_text):
    if not time_text:
        return 0

    parsed_time = dateparser.parse(str(time_text))
    if not parsed_time:
        return 0

    due_time = parsed_time.time()
    if time(0, 0) <= due_time < time(8, 0):
        return 1
    return 0
