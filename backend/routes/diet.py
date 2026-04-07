from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Dict, Any, Optional
import logging
from services.diet_service import generate_diet_plan
from utils.document_parser import parse_uploaded_file

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/generate", response_model=Dict[str, Any])
async def create_diet_plan(
    disease: str = Form(""),
    symptoms: str = Form(""),
    allergies: str = Form("None"),
    file: Optional[UploadFile] = File(None)
):
    
    if not disease and not symptoms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Disease or symptoms are required to generate a diet plan."
        )

    report_text = ""
    if file and file.filename:
        try:
            file_bytes = await file.read()
            report_text, _ = parse_uploaded_file(file.filename, file_bytes)
            logger.info(f"Successfully extracted {len(report_text)} chars from {file.filename}")
        except Exception as e:
            logger.warning(f"Failed to parse optional medical report for diet generation: {e}")
            report_text = "Parsing failed, report ignored."

    try:
        result = generate_diet_plan(
            disease=disease,
            symptoms=symptoms,
            allergies=allergies,
            report_text=report_text
        )
        return result
    except Exception as e:
        logger.exception("Error during diet plan generation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
