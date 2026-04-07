from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Dict, Any, Optional
import logging
from services.food_service import check_food_safety
from utils.document_parser import parse_uploaded_file

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/safety", response_model=Dict[str, Any])
async def check_food_endpoint(
    food_text: str = Form(""),
    disease: str = Form(""),
    symptoms: str = Form(""),
    allergies: str = Form("None"),
    food_image: Optional[UploadFile] = File(None),
    med_report: Optional[UploadFile] = File(None)
):
    
    if not food_text and not food_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Food name/description or an image of the food is required."
        )

    # Parse optional medical report text
    report_text = ""
    if med_report and med_report.filename:
        try:
            report_bytes = await med_report.read()
            report_text, _ = parse_uploaded_file(med_report.filename, report_bytes)
            logger.info(f"Successfully extracted {len(report_text)} chars from {med_report.filename}")
        except Exception as e:
            logger.warning(f"Failed to parse optional medical report for food safety: {e}")
            report_text = "Parsing failed, report ignored."

    # Read the food image bytes if provided
    food_bytes = None
    if food_image and food_image.filename:
        food_bytes = await food_image.read()

    try:
        result = check_food_safety(
            food_text=food_text,
            disease=disease,
            symptoms=symptoms,
            allergies=allergies,
            report_text=report_text,
            file_bytes=food_bytes
        )
        return result
    except Exception as e:
        logger.exception("Error during food safety check")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

from pydantic import BaseModel

class SuggestionRequest(BaseModel):
    field_type: str
    partial_text: str

@router.post("/suggest")
async def suggest_endpoint(request: SuggestionRequest):
    if not request.partial_text or len(request.partial_text) < 2:
        return {"suggestions": []}
    
    try:
        from groq import Groq
        from config import settings
        import json
        
        client = Groq(api_key=settings.GROQ_API_KEY)
        
        prompt = f"""
You are an autocomplete assistant. The user is typing in a field specifically for: '{request.field_type}'.
They have typed the prefix: "{request.partial_text}"

IMPORTANT RULES:
- EVERY single suggestion MUST begin exactly with the letters they typed: "{request.partial_text}". (e.g. if they type "Diab", suggest "Diabetes", "Diabetic Retinopathy", etc.)
- If the field is for "food" or "meal description", suggest ONLY food items, recipes, or ingredients. Do NOT suggest diseases or allergies.
- If the field is for "existing disease" or "symptoms", suggest ONLY medical conditions or symptoms. Do NOT suggest food.
- If the field is for "allergies", suggest ONLY common allergies (e.g. peanuts, gluten).
- Suggest 6 to 8 highly relevant completions matching the category '{request.field_type}'.

Return ONLY valid JSON in this exact format:
{{"suggestions": ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6"]}}
"""
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a JSON-only medical autocomplete API."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=150,
        )
        response_text = completion.choices[0].message.content
        return json.loads(response_text)
    except Exception as e:
        logger.exception(f"Error fetching suggestions for {request.field_type}")
        return {"suggestions": []}

