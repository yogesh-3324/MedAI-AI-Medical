from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Dict, Any, Optional
import logging
import requests
from services.triage_service import assess_triage
from utils.document_parser import parse_uploaded_file

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/assess", response_model=Dict[str, Any])
async def check_triage(
    symptoms: str = Form(...),
    duration: str = Form(""),
    age: str = Form(...),
    gender: str = Form(...),
    diseases: str = Form(""),
    file: Optional[UploadFile] = File(None)
):
    
    if not symptoms or not age or not gender:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Symptoms, age, and gender are required."
        )

    report_text = ""
    # Parse optional file to enrich context
    if file and file.filename:
        try:
            file_bytes = await file.read()
            report_text, _ = parse_uploaded_file(file.filename, file_bytes)
            logger.info(f"Successfully extracted {len(report_text)} chars from {file.filename}")
        except Exception as e:
            logger.warning(f"Failed to parse optional medical report: {e}")
            # We don't fail the whole request just because OCR failed, it's optional!
            report_text = "Parsing failed, report ignored."

    try:
        # Call LLM service
        result = assess_triage(
            symptoms=symptoms,
            duration=duration,
            age=age,
            gender=gender,
            diseases=diseases,
            report_text=report_text
        )
        return result
    except Exception as e:
        logger.exception("Error during triage assessment")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@router.get("/hospitals")
def get_nearby_hospitals(lat: float, lng: float):
    # Search within ~5km radius
    query = f"""
    [out:json];
    (
      node["amenity"="hospital"](around:5000,{lat},{lng});
      node["amenity"="clinic"](around:5000,{lat},{lng});
      way["amenity"="hospital"](around:5000,{lat},{lng});
    );
    out center;
    """
    try:
        response = requests.post("https://overpass-api.de/api/interpreter", data=query, timeout=8)
        if response.status_code == 200:
            data = response.json()
            hospitals = []
            for element in data.get("elements", []):
                tags = element.get("tags", {})
                name = tags.get("name")
                phone = tags.get("phone") or tags.get("contact:phone") or ""
                if name:
                    hospitals.append({"name": name, "phone": phone})
            
            # keep unique by name, just in case
            unique_hospitals = []
            seen = set()
            for h in hospitals:
                if h['name'] not in seen:
                    unique_hospitals.append(h)
                    seen.add(h['name'])
                    
            return {"hospitals": unique_hospitals[:8]} # Return top 8
            
        return {"hospitals": []}
    except Exception as e:
        logger.warning(f"Overpass API fetch failed: {e}")
        return {"hospitals": []}
