"""
services/groq_service.py
Calls the Groq API with a medical RAG prompt.
Model: llama3-8b-8192 (fast, free-tier-friendly)
"""

import logging
from typing import List, Dict

from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MedAI, a helpful and empathetic medical AI assistant.
Your role is to answer health and medical questions clearly and accurately.

Guidelines:
- **FORMATTING RULES:** You MUST format your response using highly organized Markdown. Use plenty of emojis to make it visual and engaging. Use **bold** text to highlight important clinical terms and take-home points. Always use bullet points for lists.
- Use ONLY the provided context to answer. If the context doesn't contain enough information, say so honestly.
- Be concise but thorough. 
- Always recommend consulting a qualified healthcare professional for personalised advice.
- Do NOT diagnose or prescribe. Offer information and insights only.
- Maintain a warm, professional, and reassuring tone.
- If the question is not medical, kindly redirect the user to ask health-related questions."""


def build_rag_prompt(query: str, context_chunks: List[Dict]) -> str:
    """
    Build a RAG prompt by injecting retrieved context before the user question.
    """
    if context_chunks:
        context_text = "\n\n---\n\n".join(
            f"[Chunk {i+1} | relevance: {c['score']:.2f}]\n{c['text']}"
            for i, c in enumerate(context_chunks)
        )
        prompt = (
            f"The following excerpts are from the user's uploaded medical document:\n\n"
            f"{context_text}\n\n"
            f"---\n\n"
            f"Based on the above context, please answer the following question:\n"
            f"{query}"
        )
    else:
        # No document uploaded — general medical Q&A
        prompt = query

    return prompt


def generate_response(query: str, context_chunks: List[Dict]) -> str:
    """
    Send the RAG-augmented prompt to Groq and return the model's reply.

    Args:
        query:          The user's message.
        context_chunks: Retrieved chunks from Pinecone (may be empty).

    Returns:
        The assistant's text response.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)
    user_message = build_rag_prompt(query, context_chunks)

    logger.info(
        "Sending request to Groq (%s). Context chunks: %d.",
        settings.GROQ_MODEL,
        len(context_chunks),
    )

    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.4,
        max_tokens=1024,
        top_p=0.9,
    )

    response_text = completion.choices[0].message.content
    logger.info("Groq response received (%d chars).", len(response_text))
    return response_text
