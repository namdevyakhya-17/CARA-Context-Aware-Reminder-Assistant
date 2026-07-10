# reminder checker
from agents.location_services_agent.geofence import distance
from agents.location_services_agent.reminder_store import load_reminders
from agents.location_services_agent.reminder_store import write_reminders
from utils.config import DEFAULT_LOCATION_RADIUS_METERS

def check_reminders(user_lat, user_lon):
    reminders = load_reminders()

    triggered = []
    changed = False
    print(
        f"\n[CHECKER] User Location:"
        f" ({user_lat},{user_lon})"
    )
    for reminder in reminders:
        if reminder.get("trigger_type") != "location":
            continue
        if reminder.get("status", "pending") != "pending":
            continue
        if reminder.get("latitude") is None or reminder.get("longitude") is None:
            continue

        print(
            f"[CHECKER] Checking reminder:"
            f" {reminder.get('task', '')}"
        )
        dist = distance(user_lat,user_lon,reminder["latitude"],reminder["longitude"])
        print(
            f"[CHECKER] Distance="
            f" {dist:.2f} meters"
        )
        if dist <= reminder.get("radius", DEFAULT_LOCATION_RADIUS_METERS):
            print(
                f"[TRIGGERED]"
                f" {reminder.get('task', '')}"
            )
            reminder["status"] = "action_required"
            triggered.append(reminder)
            changed = True
        
    if changed:
        write_reminders(reminders)
    return triggered
