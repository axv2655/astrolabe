from fastapi import FastAPI
from events import router as event_Router,  fetch_event_info 
from auth import router as auth_Router, login, LoginFormat, LoginOutput
from pastEvent import router as pastevent_Router, past_event_fetching, TokenInput, EventOutput

app = FastAPI()

@app.get("/")
async def root():
   # data = await fetch_event_info("2026-03-07")
    loginDeats = LoginFormat(email="tharunsevvel@gmail.com",password="123")
    data2 = await login(loginDeats)
    tokenDeats = TokenInput(token=data2.token)
    print(tokenDeats)
    data3 = await past_event_fetching(tokenDeats)
    print(data3)
    return {"message":"Hello World","events":data,"login token":data2,"past events":data3}

app.include_router(event_Router, prefix="/events")
app.include_router(auth_Router, prefix="/login")
app.include_router(pastevent_Router, prefix="/pastEvent")
#Events Routing