"""
services/pinecone_service.py
Handles all Pinecone interactions:
  - Create / connect to index
  - Upsert document chunks with their embeddings
  - Retrieve top-K similar chunks for a query embedding
"""

import logging
import hashlib
from typing import List, Dict, Any

from config import settings

logger = logging.getLogger(__name__)

_pinecone_index = None


def _get_pinecone_index():
    """Lazy-initialise and cache the Pinecone index connection."""
    global _pinecone_index

    if _pinecone_index is not None:
        return _pinecone_index

    try:
        from pinecone import Pinecone, ServerlessSpec
    except ImportError:
        raise RuntimeError(
            "pinecone-client not installed. Run: pip install pinecone-client"
        )

    pc = Pinecone(api_key=settings.PINECONE_API_KEY)

    # Create the index if it doesn't exist yet
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    if settings.PINECONE_INDEX_NAME not in existing_indexes:
        logger.info(
            "Creating Pinecone index '%s' (dim=%d) …",
            settings.PINECONE_INDEX_NAME,
            settings.EMBEDDING_DIMENSION,
        )
        pc.create_index(
            name=settings.PINECONE_INDEX_NAME,
            dimension=settings.EMBEDDING_DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(
                cloud=settings.PINECONE_CLOUD,
                region=settings.PINECONE_REGION,
            ),
        )
        logger.info("Pinecone index created.")
    else:
        logger.info("Connected to existing Pinecone index '%s'.", settings.PINECONE_INDEX_NAME)

    _pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _pinecone_index


def _chunk_id(session_id: str, chunk_index: int) -> str:
    """Generate a deterministic vector ID from the session + chunk position."""
    raw = f"{session_id}::{chunk_index}"
    return hashlib.md5(raw.encode()).hexdigest()


def upsert_document_chunks(
    chunks: List[str],
    embeddings: List[List[float]],
    session_id: str,
    filename: str,
) -> int:
    """
    Upsert embedded chunks into Pinecone under a given session namespace.

    Args:
        chunks:     List of text chunks.
        embeddings: Corresponding embedding vectors.
        session_id: Unique ID for this upload session (used as Pinecone namespace).
        filename:   Original filename stored in metadata.

    Returns:
        Number of vectors upserted.
    """
    index = _get_pinecone_index()

    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append(
            {
                "id": _chunk_id(session_id, i),
                "values": embedding,
                "metadata": {
                    "text": chunk,
                    "chunk_index": i,
                    "filename": filename,
                    "session_id": session_id,
                },
            }
        )

    # Pinecone recommends batches of ≤ 100 vectors
    batch_size = 100
    total_upserted = 0
    for start in range(0, len(vectors), batch_size):
        batch = vectors[start : start + batch_size]
        index.upsert(vectors=batch, namespace=session_id)
        total_upserted += len(batch)

    logger.info(
        "Upserted %d vectors into namespace '%s'.", total_upserted, session_id
    )
    return total_upserted


def retrieve_similar_chunks(
    query_embedding: List[float],
    session_id: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Query Pinecone for the most similar chunks to the given embedding.

    Args:
        query_embedding: Query vector.
        session_id:      Namespace to search in (limits search to this document).
        top_k:           Number of results to return.

    Returns:
        List of dicts with keys: text, score, chunk_index, filename.
    """
    index = _get_pinecone_index()

    response = index.query(
        vector=query_embedding,
        top_k=top_k,
        namespace=session_id,
        include_metadata=True,
    )

    results = []
    for match in response.matches:
        results.append(
            {
                "text": match.metadata.get("text", ""),
                "score": match.score,
                "chunk_index": match.metadata.get("chunk_index", -1),
                "filename": match.metadata.get("filename", ""),
            }
        )

    logger.info(
        "Retrieved %d similar chunks from namespace '%s'.", len(results), session_id
    )
    return results


def delete_session_namespace(session_id: str) -> None:
    """Delete all vectors belonging to a session (cleanup after conversation)."""
    index = _get_pinecone_index()
    try:
        index.delete(delete_all=True, namespace=session_id)
        logger.info("Deleted namespace '%s' from Pinecone.", session_id)
    except Exception as e:
        logger.warning("Could not delete namespace '%s': %s", session_id, e)
