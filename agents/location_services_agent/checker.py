# reminder checker
from agents.location_services_agent.geofence import distance
import json

FILE="database/reminders.json"
def check_reminders(user_lat, user_lon):
    with open(FILE,"r") as f:
        reminders = json.load(f)

    triggered = []
    changed = False
    print(
        f"\n[CHECKER] User Location:"
        f" ({user_lat},{user_lon})"
    )
    for reminder in reminders:
        print(
            f"[CHECKER] Checking reminder:"
            f" {reminder['task']}"
        )
        if reminder["status"] == "triggered":
            continue
        dist = distance(user_lat,user_lon,reminder["latitude"],reminder["longitude"])
        print(
            f"[CHECKER] Distance="
            f" {dist:.2f} meters"
        )
        if dist<=reminder["radius"]:
            print(
                f"[TRIGGERED]"
                f" {reminder['task']}"
            )
            reminder["status"] = "triggered"
            triggered.append(reminder)
            changed = True
        
    if changed:
        with open(FILE,"w") as f:
            json.dump(reminders, f, indent=4)
    return triggered