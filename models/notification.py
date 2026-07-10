from pydantic import BaseModel
from typing import Optional

class NotificationDecision(BaseModel):
    reminder_id: int
    action: str
    advance_minutes: int = 0
    snooze_minutes: int = 0

class ContextData(BaseModel):
    location_type: Optional[str] = None
    current_hour: Optional[int] = None

class ReminderData(BaseModel):
    id: int 
    task: str
    priority: str
    user_id: int
