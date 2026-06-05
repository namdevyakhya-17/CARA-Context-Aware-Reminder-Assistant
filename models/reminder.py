from pydantic import BaseModel
from typing import List

class Reminder(BaseModel):
    task: str
    intent: str="reminder"
    datetime: str=""
    location: str=""
    normalised_time: str=""
    trigger_type: str=""
    priority: str=""
    missing_feilds: List[str] = []
