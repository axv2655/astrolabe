from fastapi import FastAPI, Query, HTTPException
from datetime import datetime
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

x_api_key = os.getenv("x_api_key")


def get_headers() -> dict:
    if not x_api_key:
        raise HTTPException(
            status_code=500, detail="x_api_key environment variable is not set"
        )
    return {"x-api-key": x_api_key}


@app.get("/")
async def root():
    return {"message": "Hello from server", "time": str(datetime.now())}


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
    print(f"[DEBUG] /autocomplete q={q!r} | total buildings: {len(buildings)}")

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
            print(f"[DEBUG]   room={full_code!r} matches={matches_query} has_digit={has_digit}")
            if matches_query and has_digit:
                results.append(full_code)
            if len(results) >= 5:
                break
        if len(results) >= 5:
            break

    print(f"[DEBUG] /autocomplete returning: {results}")
    return results


@app.get("/history")
async def history():
    return [
        {
            "name": "ECSW 1.315",
            "subtitle": "Engineering and Computer Science West",
            "date": "Mar 6",
            "time": "2:30 PM",
        },
        {
            "name": "SLC 1.102",
            "subtitle": "Student Learning Center",
            "date": "Mar 5",
            "time": "10:00 AM",
        },
        {
            "name": "GR 2.302",
            "subtitle": "Green Center",
            "date": "Mar 4",
            "time": "4:00 PM",
        },
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
    print(f"[DEBUG] /events date={date} | total buildings: {len(buildings)}")

    for building in buildings:
        building_name = building.get("building")
        for room in building.get("rooms", []):
            room_name = room.get("room", "")
            location = building_name + " " + room_name
            has_digit = any(c.isdigit() for c in location)
            for event in room.get("events", []):
                name = event.get("eventName") or event.get("section", "")
                filtered_name = name and "No Event Requesting" not in name
                print(f"[DEBUG]   location={location!r} has_digit={has_digit} name={name!r} passes_filter={bool(filtered_name and has_digit)}")
                if filtered_name and has_digit:
                    start = event.get("start_time", "")
                    end = event.get("end_time", "")
                    time_str = f"{start} - {end}" if start and end else start or end
                    events.append(
                        {
                            "name": location,
                            "subtitle": name,
                            "date": event_date,
                            "time": time_str,
                        }
                    )
                if len(events) >= 3:
                    break
            if len(events) >= 3:
                break
        if len(events) >= 3:
            break

    print(f"[DEBUG] /events returning {len(events)} events: {[e['name'] for e in events]}")
    return events
