class Notifier:
    def send(self, reminder, decision):
        print(f"""Reminder: {reminder['task']}
                  Action: {decision['action']}""")
        return {
            "status": "sent",
            "decision": decision
        }