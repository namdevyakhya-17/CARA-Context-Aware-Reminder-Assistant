def evaluate_rules(reminder, context):

    priority = reminder.get("priority", "medium").lower()

    activity = context.get(
        "activity",
        "unknown"
    ).lower()

    if priority == "high":
        return {
            "action": "NOTIFY_NOW",
            "reason": "This is a high-priority reminder, so CARA is notifying immediately.",
            "confidence": "high"
        }

    if activity == "driving":
        return {
            "action": "DELAY",
            "delay_minutes": 15,
            "reason": "The user appears to be driving, so CARA should retry shortly.",
            "confidence": "medium"
        }

    if activity == "meeting":
        return {
            "action": "DELAY",
            "delay_minutes": 30,
            "reason": "The user appears to be in a meeting, so CARA should delay the reminder.",
            "confidence": "medium"
        }

    if activity == "sleeping":
        return {
            "action": "DELAY",
            "delay_minutes": 60,
            "reason": "The user appears to be sleeping, so CARA should retry later.",
            "confidence": "medium"
        }

    if context.get("battery_level", 100) < 5:

        return {
            "action": "DELAY",
            "delay_minutes": 20,
            "reason": "Battery level is very low, so CARA should avoid interrupting immediately.",
            "confidence": "medium"
        }

    return {
        "action": "NOTIFY_NOW",
        "reason": "The reminder trigger condition is met and no blocking context was detected.",
        "confidence": "high"
    }

class RuleEngine:
    def evaluate(self, reminder, context):
        return evaluate_rules(reminder, context)
