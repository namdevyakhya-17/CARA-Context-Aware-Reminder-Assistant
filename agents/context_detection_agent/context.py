# from utils.datetime_parser import normalize_datetime
from agents.context_detection_agent.priority_rules import detect_priority
from agents.context_detection_agent.trigger_rules import detect_trigger

class ContextAgent:
    def process(self, reminder):
        # reminder["normalized_time"] = normalize_datetime(reminder.get("datetime"))
        reminder["priority"] = detect_priority(reminder.get("task", ""))
        reminder["trigger_type"] = detect_trigger(reminder)
        missing = []
        if (reminder["trigger_type"] == "time" and not reminder.get("time") and not reminder.get("raw_time")):
            missing.append("time")

        reminder["missing_fields"] = missing
        return reminder 