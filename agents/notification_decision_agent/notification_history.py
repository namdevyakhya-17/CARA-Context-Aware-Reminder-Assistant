import json
from datetime import datetime
from utils.config import NOTIFICATION_HISTORY_FILE

FILE = NOTIFICATION_HISTORY_FILE

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

    FILE.parent.mkdir(parents=True, exist_ok=True)
    FILE.write_text(
        json.dumps(data, indent=4)
    )

class NotificationHistory:
    def log(self, reminder_id, action):
        save_action(reminder_id, action)
