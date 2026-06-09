from pydantic import BaseModel
from typing import Optional

class NotificationDecision(BaseModel):
    reminder_id: int
    action: str
    delay_minutes: int = 0
    advance_minutes: int = 0
    snooze_minutes: int = 0

class ContextData(BaseModel):
    activity: Optional[str] = None
    location_type: Optional[str] = None
    battery_level: Optional[int] = None
    current_hour: Optional[int] = None

class ReminderData(BaseModel):
    id: int 
    task: str
    priority: str
    user_id: int