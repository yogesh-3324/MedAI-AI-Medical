"""
utils/chunker.py
Splits extracted document text into overlapping chunks for embedding.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)


def split_text_into_chunks(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    """
    Split text into overlapping chunks using LangChain's RecursiveCharacterTextSplitter.

    Args:
        text:          Full document text.
        chunk_size:    Target size of each chunk in characters.
        chunk_overlap: Number of characters shared between consecutive chunks.

    Returns:
        List of text chunk strings.
    """
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        raise RuntimeError(
            "langchain-text-splitters not installed. "
            "Run: pip install langchain-text-splitters"
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        # Split on paragraph breaks first, then sentences, then words
        separators=["\n\n", "\n", ". ", "! ", "? ", " ", ""],
        length_function=len,
        is_separator_regex=False,
    )

    chunks = splitter.split_text(text)
    # Filter out empty / whitespace-only chunks
    chunks = [c.strip() for c in chunks if c.strip()]

    logger.info(
        "Split document into %d chunks (size=%d, overlap=%d)",
        len(chunks), chunk_size, chunk_overlap
    )
    return chunks
