from fastapi import APIRouter
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from agents.nlp_understanding_agent.processor import process_text
from agents.location_services_agent.geocoder import get_coordinates
from agents.location_services_agent.location_store import save_location_by_address
from agents.location_services_agent.location_store import save_current_location
from agents.location_services_agent.resolver import resolve_location
from agents.location_services_agent.reminder_store import save_reminder
from agents.location_services_agent.reminder_store import delete_reminder
from agents.location_services_agent.checker import check_reminders
from agents.notification_decision_agent.decision_service import NotificationDecisionAgent

router = APIRouter()

class InputText(BaseModel):
    text: str

@router.post("/extract")
def extract(data: InputText):
    result = process_text(data.text)
    return JSONResponse(content=result)

@router.post("/save-location-address")
def save_location(payload: dict):
    coords = get_coordinates(payload["address"])
    if not coords:
        return{
            "success":False,
            "message":"Address not found"
        }
    data = save_location_by_address(
        payload["name"],
        payload["address"],
        coords
    )
    return{
        "success":True,
        "data":data
    }

@router.post("/save-current-location")
def save_current(payload: dict):
    return save_current_location(
        payload["name"],
        payload["latitude"],
        payload["longitude"]
    )

@router.post("/create-location-reminder")
def create_location_reminder(payload: dict):
    coords = resolve_location(payload["location"])
    if not coords:
        return {
            "success": False,
            "message": "Location not found"
        }
    
    reminder = save_reminder(
        payload["task"],
        payload["location"],
        coords
    )

    return {
        "success": True,
        "reminder": reminder
    }

@router.delete("/reminders/{reminder_id}")
def remove_reminder(reminder_id: str):
    deleted = delete_reminder(reminder_id)
    return {
        "success": deleted,
        "reminder_id": reminder_id
    }

@router.post("/update-user-location")
def update_user_location(payload: dict):
    triggered = check_reminders(
        payload["latitude"],
        payload["longitude"]
    )
    return {
        "triggered": triggered
    }

notification_agent = NotificationDecisionAgent()
@router.post("/notification/decide")
def decide(data: dict):
    reminder = data["reminder"]
    context = data["context"]
    return notification_agent.decide(reminder, context)

@router.post("/notification/snooze")
def snooze(data: dict):
    return notification_agent.snooze_reminder(
        reminder_id=data["reminder_id"],
        custom_time=data.get("snooze_minutes")
    )

@router.post("/notification/advance")
def advance(data: dict):
    return notification_agent.advance_reminder(
        reminder_id = data["reminder_id"],
        minutes = data["advance_minutes"]
    )
