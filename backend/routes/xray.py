from fastapi import APIRouter, File, UploadFile, HTTPException, status, Form
from typing import Dict, Any, List
import logging
import json
from services.xray_service import parse_xray_image, chat_about_xray, analyze_risk

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/analyze", response_model=Dict[str, Any])
async def upload_xray(file: UploadFile = File(...)):
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded."
        )

    ext = file.filename.lower()
    if not any(ext.endswith(e) for e in [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unsupported file format. Please upload an image format."
        )

    file_bytes = await file.read()
    try:
        result = parse_xray_image(file_bytes)
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve)
        )
    except Exception as e:
        logger.exception("Error processing X-Ray")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@router.post("/chat", response_model=Dict[str, Any])
async def chat_xray(
    file: UploadFile = File(...),
    message: str = Form(...),
    history: str = Form("[]")
):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    
    file_bytes = await file.read()
    try:
        hist_obj = json.loads(history)
        reply = chat_about_xray(file_bytes, message, hist_obj)
        return {"reply": reply}
    except Exception as e:
        logger.exception("Error in X-Ray chat")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/risk", response_model=Dict[str, Any])
async def risk_assessment(data: dict):
    try:
        return analyze_risk(data)
    except Exception as e:
        logger.exception("Error analyzing risk")
        raise HTTPException(status_code=500, detail=str(e))
