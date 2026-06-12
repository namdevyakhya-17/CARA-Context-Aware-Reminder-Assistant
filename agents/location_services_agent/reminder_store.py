# reminder storage
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import dateparser

FILE = Path("database/reminders.json")

PRIORITY_ORDER = {
    "high": 0,
    "medium": 1,
    "low": 2,
}


def load_reminders():
    try:
        return json.loads(FILE.read_text())
    except Exception:
        return []


def write_reminders(reminders):
    FILE.parent.mkdir(parents=True, exist_ok=True)
    FILE.write_text(json.dumps(reminders, indent=4))


def sort_reminders(reminders):
    return sorted(
        reminders,
        key=lambda reminder: (
            PRIORITY_ORDER.get(str(reminder.get("priority", "medium")).lower(), 1),
            reminder.get("date", ""),
            reminder.get("notification_time", ""),
        ),
    )


def create_reminder(payload):
    reminders = load_reminders()
    notification_time = payload.get("notification_time") or resolve_notification_time(
        payload.get("raw_time") or payload.get("time") or ""
    )

    reminder = {
        "id": payload.get("id") or str(uuid.uuid4()),
        "task": payload.get("task", ""),
        "intent": payload.get("intent", "reminder"),
        "entities": payload.get("entities", []),
        "trigger_type": payload.get("trigger_type", "time"),
        "date": payload.get("date", ""),
        "raw_time": payload.get("raw_time", ""),
        "notification_time": notification_time,
        "location": payload.get("location", ""),
        "location_name": payload.get("location_name", payload.get("location", "")),
        "priority": payload.get("priority", "medium"),
        "status": payload.get("status", "pending"),
        "snooze_until": payload.get("snooze_until", ""),
    }

    if payload.get("latitude") is not None and payload.get("longitude") is not None:
        reminder["latitude"] = payload["latitude"]
        reminder["longitude"] = payload["longitude"]
        reminder["radius"] = payload.get("radius", 100)

    reminders.append(reminder)
    write_reminders(reminders)
    return reminder


def resolve_notification_time(raw_time):
    normalized = str(raw_time).lower().strip()
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

    parsed_time = dateparser.parse(str(raw_time))
    if parsed_time:
        return parsed_time.strftime("%H:%M")

    return ""


def save_reminder(task, location_name, coords):
    reminder = create_reminder(
        {
            "task": task,
            "trigger_type": "location",
            "location": location_name,
            "location_name": location_name,
            "latitude": coords["latitude"],
            "longitude": coords["longitude"],
            "radius": 100,
            "status": "pending",
        }
    )
    print(f"[REMINDER STORE] Saving reminder for {location_name}")
    return reminder


def delete_reminder(reminder_id):
    reminders = load_reminders()
    remaining = [
        reminder for reminder in reminders
        if reminder.get("id") != reminder_id
    ]

    write_reminders(remaining)
    return len(remaining) != len(reminders)


def update_reminder(reminder_id, changes):
    reminders = load_reminders()
    updated = None

    for index, reminder in enumerate(reminders):
        if reminder.get("id") == reminder_id:
            reminders[index] = {
                **reminder,
                **changes,
            }
            updated = reminders[index]
            break

    if updated:
        write_reminders(reminders)

    return updated


def update_reminder_status(reminder_id, status):
    return update_reminder(reminder_id, {"status": status})


def snooze_reminder(reminder_id, minutes):
    snooze_until = (datetime.now() + timedelta(minutes=minutes)).isoformat()
    return update_reminder(
        reminder_id,
        {
            "status": "pending",
            "snooze_until": snooze_until,
        },
    )


def mark_due_time_reminders():
    reminders = load_reminders()
    now = datetime.now()
    triggered = []
    changed = False

    for reminder in reminders:
        if reminder.get("status", "pending") != "pending":
            continue
        if reminder.get("trigger_type") != "time":
            continue

        snooze_until = reminder.get("snooze_until")
        if snooze_until:
            try:
                if datetime.fromisoformat(snooze_until) > now:
                    continue
            except ValueError:
                continue
        else:
            due_at = reminder_due_at(reminder)
            if not due_at or due_at > now:
                continue

        reminder["status"] = "triggered"
        triggered.append(reminder)
        changed = True

    if changed:
        write_reminders(reminders)

    return triggered


def reminder_due_at(reminder):
    date = reminder.get("date")
    notification_time = reminder.get("notification_time")

    if not date or not notification_time:
        return None

    try:
        return datetime.fromisoformat(f"{date}T{notification_time}:00")
    except ValueError:
        return None
