from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Dict, Any, Optional
import logging
import json
from services.drug_service import check_drug_safety
from utils.document_parser import parse_uploaded_file

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/interactions", response_model=Dict[str, Any])
async def check_drug_interactions_endpoint(
    drugs: str = Form("[]"),
    allergies: str = Form("None"),
    drug_image: Optional[UploadFile] = File(None),
    med_report: Optional[UploadFile] = File(None)
):
    try:
        drugs_list = json.loads(drugs)
    except json.JSONDecodeError:
        drugs_list = []
    
    if not drugs_list and not drug_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="At least one medicine or an image of medicines is required."
        )

    # Parse optional medical report text
    report_text = ""
    if med_report and med_report.filename:
        try:
            report_bytes = await med_report.read()
            report_text, _ = parse_uploaded_file(med_report.filename, report_bytes)
            logger.info(f"Successfully extracted {len(report_text)} chars from {med_report.filename}")
        except Exception as e:
            logger.warning(f"Failed to parse optional medical report for drug safety: {e}")
            report_text = "Parsing failed, report ignored."

    # Read the drug image bytes if provided
    drug_bytes = None
    if drug_image and drug_image.filename:
        drug_bytes = await drug_image.read()

    try:
        result = check_drug_safety(
            drugs=drugs_list,
            allergies=allergies,
            report_text=report_text,
            file_bytes=drug_bytes
        )
        return result
    except Exception as e:
        logger.exception("Error during drug safety check")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
