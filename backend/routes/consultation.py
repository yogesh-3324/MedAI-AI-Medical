from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
from services.consultation_service import generate_consultation_report

router = APIRouter()
logger = logging.getLogger(__name__)


class TranscriptRequest(BaseModel):
    transcript: str


@router.post("/generate")
async def generate_report(body: TranscriptRequest):
    """
    Accepts a raw doctor-patient transcript and returns
    a structured medical consultation report.
    """
    if not body.transcript or not body.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty.")

    try:
        report = generate_consultation_report(body.transcript)
        return {"report": report}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception("Error generating consultation report")
        raise HTTPException(status_code=500, detail="Report generation failed. Please try again.")
