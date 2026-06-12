from agents.notification_decision_agent.rule_engine import RuleEngine
from agents.notification_decision_agent.notification_history import NotificationHistory
from agents.notification_decision_agent.snooze_manager import SnoozeManager

class NotificationDecisionAgent:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.history = NotificationHistory()
        self.snooze = SnoozeManager()

    def decide(self,reminder,context):
        decision = self.rule_engine.evaluate(reminder, context)
        self.history.log(reminder["id"],decision["action"])
        return decision

    def snooze_reminder(self, reminder_id, custom_time=None):
        snooze_minutes = self.snooze.get_snooze_time(custom_time)
        self.history.log(reminder_id, "SNOOZE")
        return {
            "action": "SNOOZE",
            "snooze_minutes": snooze_minutes
        }

    def advance_reminder(self, reminder_id, minutes):
        self.history.log(reminder_id, "ADVANCE")
        return {
            "action": "ADVANCE",
            "advance_minutes": minutes
        }
