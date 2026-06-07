def detect_trigger(reminder):
    if reminder.get("location"):
        return "location"
    if reminder.get("date") or reminder.get("time"):
        return "time"
    return "unknown"