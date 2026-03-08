from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import certifi
import os
import secrets

router = APIRouter()

@router.post("upload-image")
async def upload_img(image: UploadFile = File(...)):
    #Wrong file type has been passed
    if not image.content_type.startswith("HEIC/"):
        raise HTTPException (status_code=400, detail="Wrong file type")

    content = await image.read()

    return {
        "filename" :image.filename
        "content_type": image.content_type
        "size": len(contents)
    }

@router.post("image-gemini")
async def img_to_gemini():
    

