"""
services/rag_service.py
Orchestrates the full RAG pipeline:
  1. Parse uploaded file → extract text
  2. Chunk the text
  3. Embed each chunk
  4. Upsert into Pinecone under a session namespace
  5. On query: embed query → retrieve top-K chunks → generate LLM response
"""

import logging
import uuid

from config import settings
from utils.document_parser import parse_uploaded_file
from utils.chunker import split_text_into_chunks
from services.embedding_service import embed_texts, embed_query
from services.pinecone_service import upsert_document_chunks, retrieve_similar_chunks
from services.groq_service import generate_response

logger = logging.getLogger(__name__)


def ingest_document(filename: str, file_bytes: bytes) -> dict:
    """
    Full ingestion pipeline for an uploaded file.

    Returns:
        {
            "session_id":    str   — use this in subsequent /chat calls,
            "filename":      str,
            "file_type":     str,
            "num_chunks":    int,
            "num_vectors":   int,
        }
    """
    # Step 1 — Extract text
    logger.info("Parsing document: %s", filename)
    text, file_type = parse_uploaded_file(filename, file_bytes)

    # Step 2 — Chunk
    chunks = split_text_into_chunks(
        text,
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )
    if not chunks:
        raise ValueError("No text chunks could be extracted from the document.")

    # Step 3 — Embed
    logger.info("Embedding %d chunks …", len(chunks))
    embeddings = embed_texts(chunks)

    # Step 4 — Upsert into Pinecone
    session_id = str(uuid.uuid4())
    num_vectors = upsert_document_chunks(chunks, embeddings, session_id, filename)

    return {
        "session_id": session_id,
        "filename": filename,
        "file_type": file_type,
        "num_chunks": len(chunks),
        "num_vectors": num_vectors,
    }


def answer_query(query: str, session_id: str | None = None) -> dict:
    """
    RAG query pipeline.

    Args:
        query:      The user's question.
        session_id: If provided, retrieves context from the uploaded document.
                    If None, falls back to pure LLM (no retrieval).

    Returns:
        {
            "answer":         str,
            "context_chunks": list  — the retrieved chunks (for debugging / display),
            "used_rag":       bool,
        }
    """
    context_chunks = []
    used_rag = False

    if session_id:
        # Step 1 — Embed the query
        query_vec = embed_query(query)

        # Step 2 — Retrieve similar chunks from Pinecone
        context_chunks = retrieve_similar_chunks(
            query_vec,
            session_id=session_id,
            top_k=settings.TOP_K_RESULTS,
        )
        used_rag = bool(context_chunks)

    # Step 3 — Generate answer via Groq LLaMA
    answer = generate_response(query, context_chunks)

    return {
        "answer": answer,
        "context_chunks": context_chunks,
        "used_rag": used_rag,
    }
