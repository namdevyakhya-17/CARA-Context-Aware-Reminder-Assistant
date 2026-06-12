# reminder storage
import json
import uuid

FILE="database/reminders.json"

def load_reminders():
    try:
        with open(FILE,"r") as f:
            return json.load(f)
    except:
        return []
    
def save_reminder(task, location_name, coords):
    reminders = load_reminders()

    reminder = {
        "id": str(uuid.uuid4()),
        "task": task,
        "location_name": location_name,
        "latitude": coords["latitude"],
        "longitude": coords["longitude"],
        "radius": 100,
        "status": "pending"
    }

    reminders.append(reminder)
    print(f"[REMINDER STORE] Saving reminder "
          f"for {location_name}"
        )
    with open(FILE, "w") as f:
        json.dump(reminders, f, indent=4)

    return reminder

def delete_reminder(reminder_id):
    reminders = load_reminders()
    remaining = [
        reminder for reminder in reminders
        if reminder.get("id") != reminder_id
    ]

    with open(FILE, "w") as f:
        json.dump(remaining, f, indent=4)

    return len(remaining) != len(reminders)
