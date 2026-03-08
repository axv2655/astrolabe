from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import os
import secrets

router = APIRouter()
mongo_uri = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(mongo_uri, tlsCAFile=certifi.where())
db = client["UserData"]
user_collections = db["userDeats"]

class TokenInput(BaseModel):
    token: str

class EventOutput(BaseModel):
    events: list


@router.post("/pastEvent", response_model = EventOutput)
async def past_event_fetching(input_data: TokenInput):
    db_user = await user_collections.find_one({"token":input_data.token})
    if not db_user:
        raise HTTPException(status_code=401, detail="THis user is not signed in")
    past_events = db_user.get("past_events",[])
    return {"events":past_events} 

