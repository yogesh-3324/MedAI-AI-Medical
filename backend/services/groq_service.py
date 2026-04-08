"""
services/groq_service.py
Calls the Groq API with a medical RAG prompt.
Model: llama3-8b-8192 (fast, free-tier-friendly)
"""

import logging
from typing import List, Dict, Optional

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
    When there is context, returns an enriched string for the final user turn.
    When there is no context, just returns the raw query string.
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


def generate_response(
    query: str,
    context_chunks: List[Dict],
    history: Optional[List[Dict]] = None,
) -> str:
    """
    Send the RAG-augmented prompt to Groq and return the model's reply.

    Args:
        query:          The user's current message.
        context_chunks: Retrieved chunks from Pinecone (may be empty).
        history:        Optional list of previous turns in the format
                        [{"role": "user"|"assistant", "content": "..."}].
                        These are prepended to the messages list so the model
                        has full conversation context (max 15 turns).

    Returns:
        The assistant's text response.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)

    # Build the final user message (may include RAG context)
    final_user_content = build_rag_prompt(query, context_chunks)

    # Compose message list: system → history → current user message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if history:
        # Validate and sanitise — only keep role/content, cap at 15 turns
        safe_history = []
        for turn in history[-15:]:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                safe_history.append({"role": role, "content": content})
        messages.extend(safe_history)

    messages.append({"role": "user", "content": final_user_content})

    logger.info(
        "Sending request to Groq (%s). History turns: %d, Context chunks: %d.",
        settings.GROQ_MODEL,
        len(history) if history else 0,
        len(context_chunks),
    )

    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.4,
        max_tokens=1024,
        top_p=0.9,
    )

    response_text = completion.choices[0].message.content
    logger.info("Groq response received (%d chars).", len(response_text))
    return response_text
