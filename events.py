#Need one route that scrapes every single event for the day and return the first 3 it finds. 
#Need one route to store the locations that are entered. That location gets stored along with the time in mongo db
#Then we fetch the three most recents dates

import os 
import httpx
from fastapi import APIRouter

router = APIRouter()

x_api_key = os.getenv("x_api_key")

#Fetching event data as some json. Date format is year-month-day
async def fetch_event_info(date: str):
    url = f"https://api.utdnebula.com/astra/{date}"
    headers = {"x-api-key":x_api_key}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
    
    prune

    return response.json()

@router.get("/{date}")
async def event_info(date: str):
    data = await fetch_event_info(date)
    return data

#Remove empty columns from the json
def prune_data(data):
    events = []
    for building in data.get("buildings",[]):
        for rooms in data.get("rooms",[]):
            for event in roomt.get("events",[]):
                name = event.get("activity_name")
                if name and "No Event Requesting" not in name:
                    events.append(event)    
    return events
                    