from fastapi import FastAPI, Query, HTTPException
from datetime import datetime
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import secrets

load_dotenv()
app = FastAPI()

x_api_key = os.getenv("x_api_key")

mongo_uri = os.getenv("MONGO_URI")
client = AsyncIOMotorClient(mongo_uri, tlsCAFile=certifi.where())
db = client["UserData"]
user_collections = db["userDeats"]


class LoginFormat(BaseModel):
    email: str
    password: str

class LoginOutput(BaseModel):
    token: str
    message: str

class TokenInput(BaseModel):
    token: str

class EventOutput(BaseModel):
    events: list


def get_headers() -> dict:
    if not x_api_key:
        raise HTTPException(status_code=500, detail="x_api_key environment variable is not set")
    return {"x-api-key": x_api_key}


@app.get("/")
async def root():
    return {"message": "Hello from server", "time": str(datetime.now())}


@app.post("/login", response_model=LoginOutput)
async def login(user: LoginFormat):
    db_user = await user_collections.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="User was never made")
    if db_user.get("password") != user.password:
        raise HTTPException(status_code=401, detail="User password was wrong")

    token = secrets.token_hex(16)
    await user_collections.update_one({"email": user.email}, {"$set": {"token": token}})
    return {"token": token, "message": "Logged in properly"}


@app.post("/pastEvent", response_model=EventOutput)
async def past_event_fetching(input_data: TokenInput):
    db_user = await user_collections.find_one({"token": input_data.token})
    if not db_user:
        raise HTTPException(status_code=401, detail="This user is not signed in")

    past_events = db_user.get("past_events", [])
    return {"events": past_events}


@app.get("/autocomplete")
async def autocomplete(q: str = Query("")):
    if not q.strip():
        return []

    url = "https://api.utdnebula.com/rooms"
    headers = get_headers()

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    data = response.json()
    buildings = data.get("data", [])

    results = []
    query_lower = q.strip().lower()

    for building in buildings:
        building_name = building.get("building", "")
        tb = building.get("building")
        for room in building.get("rooms", []):
            room_code = room.get("room", "")
            full_code = tb + " " + room_code
            has_digit = any(c.isdigit() for c in full_code)
            matches_query = query_lower in building_name.lower() or query_lower in room_code.lower()
            if matches_query and has_digit:
                results.append(full_code)
            if len(results) >= 5:
                break
        if len(results) >= 5:
            break

    return results


@app.get("/history")
async def history():
    return [
        {"name": "ECSW 1.315", "subtitle": "Engineering and Computer Science West", "date": "Mar 6", "time": "2:30 PM"},
        {"name": "SLC 1.102", "subtitle": "Student Learning Center", "date": "Mar 5", "time": "10:00 AM"},
        {"name": "GR 2.302",  "subtitle": "Green Center", "date": "Mar 4", "time": "4:00 PM"},
    ]


@app.get("/events")
async def event_info():
    date = datetime.now().strftime("%Y-%m-%d")
    url = f"https://api.utdnebula.com/mazevo/{date}"
    headers = get_headers()

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    data = response.json()
    events = []
    event_date = data["data"].get("date", date)
    buildings = data["data"].get("buildings", [])

    for building in buildings:
        building_name = building.get("building")
        for room in building.get("rooms", []):
            room_name = room.get("room", "")
            location = building_name + " " + room_name
            has_digit = any(c.isdigit() for c in location)
            for event in room.get("events", []):
                name = event.get("eventName") or event.get("section", "")
                filtered_name = name and "No Event Requesting" not in name
                if filtered_name and has_digit:
                    start = event.get("start_time", "")
                    end = event.get("end_time", "")
                    time_str = f"{start} - {end}" if start and end else start or end
                    events.append({"name": location, "subtitle": name, "date": event_date, "time": time_str})
                if len(events) >= 3:
                    break
            if len(events) >= 3:
                break
        if len(events) >= 3:
            break

    return events