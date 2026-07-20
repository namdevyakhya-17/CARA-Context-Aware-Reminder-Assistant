# reminder storage
import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import dateparser
from utils.config import DEFAULT_LOCATION_RADIUS_METERS
from utils.config import REMINDERS_FILE

FILE = REMINDERS_FILE

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
    reminder_type = payload.get("type") or payload.get("trigger_type", "time")
    trigger_type = payload.get("trigger_type") or reminder_type
    location_name = (
        payload.get("location_name")
        or payload.get("placeName")
        or payload.get("place_name")
        or payload.get("location", "")
    )
    created_at = payload.get("createdAt") or payload.get("created_at") or datetime.now().isoformat()

    reminder = {
        "id": payload.get("id") or str(uuid.uuid4()),
        "type": reminder_type,
        "task": payload.get("task") or payload.get("title", ""),
        "title": payload.get("title") or payload.get("task", ""),
        "intent": payload.get("intent", "reminder"),
        "entities": payload.get("entities", []),
        "trigger_type": trigger_type,
        "date": payload.get("date", ""),
        "raw_time": payload.get("raw_time", ""),
        "notification_time": notification_time,
        "location": payload.get("location", ""),
        "location_name": location_name,
        "placeName": payload.get("placeName") or location_name,
        "address": payload.get("address", ""),
        "priority": payload.get("priority", "medium"),
        "status": payload.get("status", "pending"),
        "snooze_until": payload.get("snooze_until", ""),
        "enabled": payload.get("enabled", True),
        "triggered": payload.get("triggered", False),
        "trigger_mode": payload.get("trigger_mode") or payload.get("triggerMode", "near"),
        "triggerMode": payload.get("triggerMode") or payload.get("trigger_mode", "near"),
        "created_at": created_at,
        "createdAt": created_at,
    }

    if payload.get("latitude") is not None and payload.get("longitude") is not None:
        reminder["latitude"] = float(payload["latitude"])
        reminder["longitude"] = float(payload["longitude"])
        reminder["radius"] = int(payload.get("radius", DEFAULT_LOCATION_RADIUS_METERS))

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
            "radius": DEFAULT_LOCATION_RADIUS_METERS,
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
        status = reminder.get("status", "pending")

        # Existing unresolved reminders must not retrigger during polling.
        # The polling endpoint returns only reminders that became due now.
        if status == "triggered":
            reminder["status"] = "action_required"
            changed = True
            continue

        if status == "action_required":
            continue

        if status != "pending":
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

        reminder["status"] = "action_required"
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
