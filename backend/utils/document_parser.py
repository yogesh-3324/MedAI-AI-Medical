"""
utils/document_parser.py
Extracts plain text from uploaded files (PDF or image).
"""

import io
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file using pypdf."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        pages_text = []
        for page_num, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(f"[Page {page_num}]\n{text.strip()}")

        full_text = "\n\n".join(pages_text)
        if not full_text.strip():
            raise ValueError("PDF appears to be scanned / image-only. No extractable text found.")
        return full_text

    except ImportError:
        raise RuntimeError("pypdf is not installed. Run: pip install pypdf")


def extract_text_from_image(file_bytes: bytes) -> str:
    """OCR text extraction from an image using OCR.space API."""
    import requests
    import io
    from PIL import Image
    
    try:
        # Pre-process image: Fix format compatibility (convert PNG/WEBP to standard JPEG)
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        img.thumbnail((2000, 2000)) # Ensure dimensions aren't excessively large
        
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        processed_bytes = buf.getvalue()

        payload = {'isOverlayRequired': False, 'apikey': 'helloworld', 'language': 'eng'}
        response = requests.post(
            'https://api.ocr.space/parse/image',
            files={'filename': ('image.jpg', processed_bytes, 'image/jpeg')},
            data=payload
        )
        result = response.json()
        
        if result.get('IsErroredOnProcessing'):
            err = result.get('ErrorMessage', ["Unknown error"])
            raise Exception(err[0] if isinstance(err, list) else err)
            
        text = ""
        for item in result.get('ParsedResults', []):
            text += item.get('ParsedText', "") + "\n"
            
        if not text.strip():
            raise ValueError("No text could be extracted from the image via OCR.")
            
        return text.strip()
        
    except Exception as e:
        raise RuntimeError(f"Image text extraction failed: {str(e)}")


def parse_uploaded_file(filename: str, file_bytes: bytes) -> Tuple[str, str]:
    """
    Route to the correct extractor based on file extension.

    Returns:
        (extracted_text, file_type)
    """
    name_lower = filename.lower()

    if name_lower.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
        return text, "pdf"

    elif any(name_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"]):
        text = extract_text_from_image(file_bytes)
        return text, "image"

    elif name_lower.endswith(".txt"):
        text = file_bytes.decode("utf-8", errors="replace")
        return text, "txt"

    else:
        raise ValueError(
            f"Unsupported file type: '{filename}'. "
            "Please upload a PDF, image (PNG/JPG), or plain text file."
        )
