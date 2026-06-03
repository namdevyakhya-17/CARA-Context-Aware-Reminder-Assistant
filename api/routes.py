from fastapi import APIRouter
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from agents.agent1.processor import process_text

router = APIRouter()

class InputText(BaseModel):
    text: str


@router.post("/extract")
def extract(data: InputText):
    result = process_text(data.text)
    return JSONResponse(content=result)