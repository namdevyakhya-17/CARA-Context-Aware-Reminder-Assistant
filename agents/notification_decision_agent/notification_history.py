import json
from pathlib import Path
from datetime import datetime

FILE=Path("database/notification_history.json")

def save_action(reminder_id, action):
    try:
        data = json.loads(FILE.read_text())
    except:
        data = []
    
    data.append(
        {
            "reminder_id": reminder_id,
            "action": action,
            "timestamp": datetime.now().isoformat()
        }
    )

    FILE.write_text(
        json.dumps(data, indent=4)
    )