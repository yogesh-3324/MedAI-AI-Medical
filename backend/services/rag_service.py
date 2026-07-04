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
from services.groq_service import generate_response, generate_web_response
from services.web_search_service import get_web_context

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


def answer_query(
    query: str,
    session_id: str | None = None,
    history: list | None = None,
) -> dict:
    """
    RAG query pipeline.

    Args:
        query:      The user's question.
        session_id: If provided, retrieves context from the uploaded document.
                    If None, falls back to pure LLM (no retrieval).
        history:    Optional list of prior conversation turns in the format
                    [{"role": "user"|"assistant", "content": "..."}].
                    Passed to the LLM so it remembers prior context (max 15 turns).

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

    # Step 3 — Generate answer via Groq LLaMA (with conversation history)
    answer = generate_response(query, context_chunks, history=history)

    return {
        "answer": answer,
        "context_chunks": context_chunks,
        "used_rag": used_rag,
    }


def answer_query_with_web_search(
    query: str,
    history: list | None = None,
) -> dict:
    """
    Web-search-augmented query pipeline.

    Steps:
      1. Search DuckDuckGo for the query.
      2. Fetch and extract text from top result pages.
      3. Pass context blocks to Groq LLaMA with a web-specific prompt.
      4. Return the answer + a list of source citations.
    
    CRITICAL BEHAVIOR:
      - If no relevant context is found (empty context_blocks), explicitly tells user
        instead of falling back to hallucination via pre-training data.
      - This prevents the chatbot from making up information about current events.

    Args:
        query:   The user's question.
        history: Optional prior conversation turns.

    Returns:
        {
            "answer":          str,
            "context_chunks": [],
            "used_rag":       False,
            "used_web_search": True,
            "sources":        [{"title": str, "url": str}, ...],
        }
    """
    logger.info("🔍 Web search mode initiated — query: %s", query[:80])

    # Step 1 & 2 — Search + fetch context + filter by relevance (>0.68)
    context_blocks, sources = get_web_context(query)

    # ANTI-HALLUCINATION CHECK: If no relevant context found, refuse to hallucinate
    if not context_blocks:
        logger.warning("❌ Web search returned NO relevant context for query: %s", query[:80])
        answer = (
            f"❌ **Unable to find current information**\n\n"
            f"I searched the web for information about '{query}' but could not find reliable, "
            f"relevant sources to provide a factual answer.\n\n"
            f"**Why this happens:**\n"
            f"- The topic may be too new or niche for web coverage\n"
            f"- Search results didn't contain enough specific detail\n"
            f"- Information may not be publicly available online\n\n"
            f"**Recommendation:** Try reformulating your question with more specific details, or consult "
            f"a healthcare professional for personalized medical advice."
        )
        return {
            "answer":          answer,
            "context_chunks": [],
            "used_rag":        False,
            "used_web_search": True,
            "sources":         [],
        }

    logger.info("✓ Retrieved %d relevant context blocks from web search", len(context_blocks))

    # Step 3 — Generate answer via Groq with web context
    try:
        answer = generate_web_response(query, context_blocks, history=history)
    except Exception as exc:
        logger.exception("Web-search LLM call failed: %s", exc)
        # We explicitly tell the user that the live search pipeline failed
        answer = (
            f"⚠️ **Web Search Pipeline Failed**\n\n"
            f"An internal error ({type(exc).__name__}) prevented the model from processing the web search results. "
            f"This often happens if the context window limit was exceeded by too many search results or a long chat history.\n\n"
            f"**Falling back to base LLM knowledge (may not be current):**\n\n"
        )
        answer += generate_response(query, [], history=history)
        sources = []

    return {
        "answer":          answer,
        "context_chunks": [],
        "used_rag":        False,
        "used_web_search": True,
        "sources":         sources,
    }
