"""
services/embedding_service.py
Generates dense vector embeddings using a local sentence-transformers model.
The model is loaded once and cached for the lifetime of the process.
"""

import logging
from typing import List
from functools import lru_cache

from config import settings

logger = logging.getLogger(__name__)

# Module-level cache so the model loads only once
_model = None


def get_embedding_model():
    """Lazy-load and cache the sentence-transformer model."""
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("Embedding model loaded successfully.")
        except ImportError:
            raise RuntimeError(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Convert a list of strings into their embedding vectors.

    Args:
        texts: List of text strings to embed.

    Returns:
        List of embedding vectors (list of floats), one per input string.
    """
    if not texts:
        return []

    model = get_embedding_model()
    # encode() returns a numpy array; convert to plain Python lists for JSON serialisation
    embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
    return embeddings.tolist()


def embed_query(query: str) -> List[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]
