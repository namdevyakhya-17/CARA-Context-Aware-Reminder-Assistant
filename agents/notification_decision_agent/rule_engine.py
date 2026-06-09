def evaluate_rules(reminder, context):

    priority = reminder["priority"].lower()

    activity = context.get(
        "activity",
        "unknown"
    ).lower()

    if priority == "high":
        return {
            "action": "NOTIFY_NOW"
        }

    if activity == "driving":
        return {
            "action": "DELAY",
            "delay_minutes": 15
        }

    if activity == "meeting":
        return {
            "action": "DELAY",
            "delay_minutes": 30
        }

    if activity == "sleeping":
        return {
            "action": "DELAY",
            "delay_minutes": 60
        }

    if context.get("battery_level", 100) < 5:

        return {
            "action": "DELAY",
            "delay_minutes": 20
        }

    return {
        "action": "NOTIFY_NOW"
    }