from fastapi import FastAPI, Query, HTTPException, UploadFile, File
from datetime import datetime
import base64
import httpx
import os
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

x_api_key = os.getenv("x_api_key")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")


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
            matches_query = (
                query_lower in building_name.lower() or query_lower in room_code.lower()
            )
            print(
                f"[DEBUG]   room={full_code!r} matches={matches_query} has_digit={has_digit}"
            )
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
                print(
                    f"[DEBUG]   location={location!r} has_digit={has_digit} name={name!r} passes_filter={bool(filtered_name and has_digit)}"
                )
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

    print(
        f"[DEBUG] /events returning {len(events)} events: {[e['name'] for e in events]}"
    )
    return events


@app.post("/gemini")
async def gemini_describe(file: UploadFile = File(...)):
    if not GEMINI_API_KEY or not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=500, detail="GEMINI_API_KEY or ELEVENLABS_API_KEY not set"
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    # --- Gemini vision ---
    try:
        from google import genai
        from google.genai import types as genai_types

        gen_prompt = """You are a friendly campus navigation assistant for the University of Texas at Dallas (UTD). You will be given an image of the user's current surroundings, their current location (as a building name or landmark), and their desired destination on campus.
        Your job is to provide clear, spoken walking directions in exactly 2 to 3 sentences. These directions will be read aloud by a text-to-speech voice, so follow these rules strictly:
        - Write in natural, conversational spoken English — as if a helpful person is talking to them.
        - Do NOT use any special characters, symbols, bullet points, arrows, abbreviations, or markdown formatting.
        - Do NOT say "north," "south," "east," or "west" unless it is part of a well-known building name. Instead, use visual landmarks, building names, and relative directions like "turn left," "turn right," "keep straight," or "you will see it on your right."
        - Reference recognizable campus landmarks from the image or from general UTD campus knowledge to orient the user.
        - Keep it brief. No more than 3 sentences total.
        - Begin with a grounding phrase that acknowledges where the user currently is, then guide them step by step to the destination.
        - End with a reassuring arrival cue, such as "You will arrive at your destination on the left" or "The entrance will be straight ahead."
        - If the image is too blurry, unclear, or does not show enough useful context to provide accurate directions, politely ask the user to take a clearer photo of their surroundings and try again.
        Example output style:
        "Starting from the Plinth, head toward the Activity Center and walk along the main pathway past the fountain. Continue straight until you pass the Student Services building on your right. The Jindal School of Management will be just ahead on your left.\"

        The user is near SCI 2.139 and is navigating towards ECSW 1.315
        """
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                genai_types.Content(
                    role="user",
                    parts=[
                        genai_types.Part.from_bytes(
                            data=image_bytes,
                            mime_type=file.content_type or "image/jpeg",
                        ),
                        genai_types.Part(
                            text=gen_prompt
                            # text="You are acting as a helpful UTD navigation specialist. You will be given an image alongside navigational data as to where the user is trying to navigate. Identify where the user is and provide concise (3 sentences or less) instructions to help the user navigate to their destination from their current location, making reference to details provided in the image. The user is trying to navigate to ECSW 1.315 and they are near SCI 2.139"
                        ),
                    ],
                )
            ],
        )
        description = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    # --- ElevenLabs TTS ---
    try:
        from elevenlabs import ElevenLabs

        if description is None:
            raise Exception("Description Not Found")
        el_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        audio_iter = el_client.text_to_speech.convert(
            voice_id=ELEVENLABS_VOICE_ID,
            text=description,
            model_id="eleven_turbo_v2_5",
            output_format="mp3_44100_64",
        )
        audio_bytes = b"".join(audio_iter)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs API error: {e}")

    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    return {"transcript": description, "audio_base64": audio_b64}
