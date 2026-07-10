import json
from utils.config import USER_BEHAVIOUR_FILE

FILE_PATH = USER_BEHAVIOUR_FILE

class UserBehaviorTracker:
    def __init__(self):
        if not FILE_PATH.exists():
            FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
            FILE_PATH.write_text("[]")

    def update(self,user_id,action):
        data = json.loads(FILE_PATH.read_text())
        user = None
        for item in data:
            if item["user_id"] == user_id:
                user = item
                break

        if user is None:
            user = {
                "user_id": user_id,
                "opened": 0,
                "ignored": 0,
                "snoozed": 0
            }

            data.append(user)
        if action == "OPENED":
            user["opened"] += 1

        elif action == "IGNORED":
            user["ignored"] += 1

        elif action == "SNOOZED":
            user["snoozed"] += 1

        FILE_PATH.write_text(json.dumps(data, indent=4))

    def get_behavior(self,user_id):
        data = json.loads(FILE_PATH.read_text())
        for item in data:
            if item["user_id"] == user_id:
                return item
        return None
