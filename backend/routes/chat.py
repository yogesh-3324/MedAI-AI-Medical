"""
routes/chat.py
Two endpoints consumed by the React frontend:

  POST /api/chat/upload   — ingest a document, return session_id
  POST /api/chat/message  — send a query (+ optional session_id), get an answer
"""

import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.rag_service import ingest_document, answer_query

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request / Response models ────────────────────────────────────────────────

class MessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None   # present only when a file was previously uploaded


class UploadResponse(BaseModel):
    session_id: str
    filename: str
    file_type: str
    num_chunks: int
    message: str


class MessageResponse(BaseModel):
    answer: str
    used_rag: bool


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=UploadResponse,
    summary="Upload a medical document for RAG ingestion",
)
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts a PDF or image file, runs the full ingestion pipeline
    (parse → chunk → embed → upsert to Pinecone), and returns a
    session_id the client must send with every subsequent /message call.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided.",
        )

    # Validate file type early
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp", ".txt"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    try:
        file_bytes = await file.read()
        result = ingest_document(filename=file.filename, file_bytes=file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        logger.exception("Error during document ingestion: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {str(e)}",
        )

    return UploadResponse(
        session_id=result["session_id"],
        filename=result["filename"],
        file_type=result["file_type"],
        num_chunks=result["num_chunks"],
        message=(
            f"✅ Document '{result['filename']}' processed successfully. "
            f"{result['num_chunks']} chunks indexed. You can now ask questions about it."
        ),
    )


@router.post(
    "/message",
    response_model=MessageResponse,
    summary="Send a query and receive a RAG-powered answer",
)
async def send_message(request: MessageRequest):
    """
    Accepts a user message and an optional session_id (from a previous /upload).
    - If session_id is present:  retrieve relevant chunks → generate contextual answer.
    - If session_id is absent:   fall back to pure LLM (general medical Q&A).
    """
    if not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )

    try:
        result = answer_query(
            query=request.message.strip(),
            session_id=request.session_id,
        )
    except Exception as e:
        logger.exception("Error generating response: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate response: {str(e)}",
        )

    return MessageResponse(
        answer=result["answer"],
        used_rag=result["used_rag"],
    )
