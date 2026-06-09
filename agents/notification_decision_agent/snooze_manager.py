DEFAULT_SNOOZE = 10

class SnoozeManager:
    def get_snooze_time(custom_time=None):
        if custom_time is None:
            return DEFAULT_SNOOZE
        return custom_time