from fastapi import FastAPI
from events import router as event_Router,  fetch_event_info 
from auth import router as auth_Router, login, LoginFormat, LoginOutput

app = FastAPI()

@app.get("/")

@app.get("/events/{date}")
async def get_events(date: str):
    events = await fetch_event_info(date)
    return {"events": events}

@app.post("/login")
async def user_login(user: LoginFormat):
    token_data = await login(user)
    return token_data

async def root():
    data = await fetch_event_info("2026-03-07")
    print(data)
    loginDeats = LoginFormat(email="tharunsevvel@gmail.com",password="123")
    data2 = await login(loginDeats)
    return {"message":"Hello World","events":data,"login token":data2}

app.include_router(event_Router, prefix="/events")
app.include_router(auth_Router, prefix="/login")
#Events Routing