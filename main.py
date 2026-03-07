from fastapi import FastAPI
from events import router as event_Router,  fetch_event_info 

app = FastAPI()

@app.get("/")
async def root():
    data = await fetch_event_info("2026-03-07")
    print(data)
    return {"message":"Hello World","events":data}

app.include_router(event_Router, prefix="/events")
#Events Routing