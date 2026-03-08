from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient
import os
import secrets

router = APIRouter()
mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri)
db = client["UserData"]
user_collections = db["userDeats"]

class LoginFormat(BaseModel):
    email: str
    password: str

class LoginOutput(BaseModel):
    token: str
    message: str

@router.post("/login", response_model = LoginOutput)
async def login(user:LoginFormat):
    db_user = user_collections.find_one({"email":user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="User was never made")
    
    if db_user.get("password") != user.password:
        raise HTTPException(status_code=401, detail="User password was wrong")

    token = secrets.token_hex(16)
    user_collections.update_one({"email":user.email},{"$set":{"token":token}})
    return {"token":token, "message":"Logged in properly"}
