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


WEB_SEARCH_SYSTEM_PROMPT = """You are MedAI, a precise medical AI assistant with access to LIVE WEB SEARCH RESULTS.
Your job is to synthesize factual, structured answers grounded entirely in the provided sources.

CRITICAL RULES — follow these exactly:

1. ENTITY DISAMBIGUATION
   - A "drug approval" means an FDA-approved therapeutic medication (small molecule, biologic, antibody, etc.)
   - A "companion diagnostic" or "CDx" is a LAB TEST, not a drug. Do NOT report a CDx as a drug approval.
   - A "device approval" is not a drug. Only report drugs unless the user specifically asks for diagnostics.

2. STRUCTURED FIELD EXTRACTION
   When the user asks for specific fields (date, indication, trial results, source), extract each one
   EXPLICITLY and label it. If a field is genuinely not in the sources, say: "[Not found in sources]"
   Do NOT skip the field or bury it in prose.

3. INLINE CITATIONS
   After EVERY specific factual claim, add the source reference in brackets: [Source N]
   Example: "The FDA approved pembrolizumab on June 17, 2026 [Source 2] for..."
   Do NOT collect all citations at the end — tie each fact to its source.

4. FORMATTING
   Use structured Markdown with clearly labeled sections. Use **bold** for drug names, dates, and key terms.
   Use bullet points for lists of trial results.

5. HONESTY
   If the sources do not contain enough information to fully answer the question, say so clearly
   for EACH missing field — do not fabricate, estimate, or extrapolate dates or trial data.

6. MEDICAL SAFETY
   Recommend consulting a qualified healthcare professional for personalised clinical decisions."""


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
        temperature=0.3,
        max_tokens=1280,
        top_p=0.85,
    )

    response_text = completion.choices[0].message.content
    logger.info("Groq response received (%d chars).", len(response_text))
    return response_text


def build_web_prompt(query: str, context_blocks: List[Dict]) -> str:
    """
    Build a structured SAG prompt — v3 (Anti-Hallucination Edition).

    Improvements over v2:
     - Pre-output completeness checklist (Problem 15)
     - Contradiction detection rule: drug != diagnostic (Problem 27)
     - Temporal reasoning instructions for 'most recent' queries (Problem 24)
     - Confidence calibration: never infer unsupported facts (Problems 10/11/22/23/26)
     - Authority hierarchy guidance (Problems 18/19)
     - Per-field honesty: mark each missing field explicitly (Problems 3/12/13/30)
     - NEW: Explicit "no context" handling to prevent hallucination
    
    IMPORTANT: This function should ONLY be called after answer_query_with_web_search()
    has already verified that context_blocks is not empty. If empty, it would have returned
    an explicit "no results found" response earlier.
    """
    if not context_blocks:
        logger.warning("⚠️ build_web_prompt called with empty context! This should have been caught upstream.")
        return (
            f"{query}\n\n"
            "CRITICAL: No web search results were provided by the system. "
            "You must explicitly state: 'I could not find current information about this query.' "
            "Do NOT attempt to answer from pre-training data. This is a safety failsafe."
        )

    # Include minimal context warning if very few sources
    context_warning = ""
    if len(context_blocks) <= 2:
        context_warning = (
            f"⚠️  WARNING: Only {len(context_blocks)} source(s) available. "
            f"Be especially careful about completeness and honesty. "
            f"If the answer is incomplete, explicitly state '[Incomplete coverage in available sources]'.\n\n"
        )

    formatted_sources = ("\n\n" + "=" * 60 + "\n\n").join(
        f"[SOURCE {i+1}]\n"
        f"Title            : {b['title']}\n"
        f"URL              : {b['url']}\n"
        f"Relevance Score  : {b.get('relevance_score', 'N/A')} (scale 0-1; >0.68 = high)\n"
        f"Authority        : {'HIGH (official regulatory)' if 'fda.gov' in b['url'] or 'nih.gov' in b['url'] else 'STANDARD'}\n\n"
        f"{b['content']}"
        for i, b in enumerate(context_blocks)
    )

    prompt = (
        f"{context_warning}"
        f"LIVE WEB SEARCH RESULTS (authority-ranked, retrieved now):\n"
        f"{'=' * 60}\n"
        f"{formatted_sources}\n"
        f"{'=' * 60}\n\n"

        f"USER QUESTION:\n{query}\n\n"

        f"INSTRUCTIONS FOR YOUR ANSWER (ANTI-HALLUCINATION MODE):\n\n"
        
        f"1. DIRECT & FACTUAL EXTRACTION ONLY\n"
        f"   - Extract ONLY facts that explicitly appear in the sources above.\n"
        f"   - Use clear Markdown formatting (bullet points, **bold** for key terms).\n"
        f"   - Do NOT include your internal reasoning. Provide only the final answer.\n\n"

        f"2. STRICT GROUNDING & MANDATORY INLINE CITATIONS\n"
        f"   - EVERY factual claim MUST cite its source: [Source N]\n"
        f"   - Example: 'Pembrolizumab was approved on June 17, 2026 [Source 2] for metastatic melanoma.'\n"        f"   - Only cite a source if it directly supports that exact fact.\n"        f"   - Prioritize HIGH authority sources (FDA, NIH, official medical journals).\n"
        f"   - If a fact appears in multiple sources, cite the highest authority.\n\n"

        f"3. **CRITICAL** ANTI-HALLUCINATION RULES\n"
        f"   a) NUMBERS & STATISTICS\n"
        f"      - NEVER output numerical data that doesn't appear verbatim in sources.\n"
        f"      - If asked for trial results (ORR, PFS, OS) not in text: 'Numerical data not in provided sources.'\n"
        f"      - NEVER estimate, round, or extrapolate percentages or dates.\n\n"
        f"   b) MISSING INFORMATION\n"
        f"      - For each field asked (approval date, trial name, indication): explicitly state if NOT in sources.\n"
        f"      - Flag incomplete coverage: 'Available sources do not contain [field]. Sources cover: [what they do cover].'\n\n"
        f"   c) PRE-TRAINING DATA PROHIBITION\n"
        f"      - ABSOLUTELY NO information from your model training data.\n"
        f"      - If a drug/trial name isn't in the text above, you have NEVER HEARD OF IT.\n"
        f"      - If unsure, SAY SO. Example: 'This trial/drug is not mentioned in the retrieved sources.'\n\n"
        f"   d) TEMPORAL HONESTY\n"
        f"      - State when information was last updated (if available in sources).\n"
        f"      - If user asks about 'latest' outcomes and sources are old, flag it: 'Last data available: [date from Source N]'\n\n"

        f"4. ENTITY TYPE VERIFICATION\n"
        f"   - Drug (small molecule/biologic/antibody) ≠ Diagnostic test (lab test/imaging/companion diagnostic)\n"
        f"   - Only report what was asked for. Don't substitute similar entities.\n"
        f"   - If sources mention related but different entities, explicitly note the distinction.\n\n"
        f"5. STRUCTURED LONG-FORM RESPONSE\n"
        f"   - Produce a long, structured answer centered around the user's question.\n"
        f"   - Start with a brief SUMMARY, then provide clear sections such as: Background, Key Findings, Important Dates, Implications, and Sources.\n"
        f"   - If dates are present in sources, list them explicitly under an 'Important Dates' section.\n"
        f"   - Keep the response focused on the query and avoid unrelated tangents.\n\n"

        f"5. QUALITY GATES BEFORE RESPONDING\n"
        f"   - Ask yourself: 'Is every fact I stated explicitly in the sources?'\n"
        f"   - Ask yourself: 'Are there any [missing fields]?'\n"
        f"   - Ask yourself: 'Could the user use this to make a medical decision safely?'\n"
        f"   - If answer is 'no' to any, add disclaimers or state incomplete coverage.\n"
    )
    return prompt

def generate_web_response(
    query: str,
    context_blocks: List[Dict],
    history: Optional[List[Dict]] = None,
) -> str:
    """
    Generate a response grounded in live web search results.

    Args:
        query:          The user's current message.
        context_blocks: Web search context [{title, url, content}, ...].
        history:        Optional prior conversation turns.

    Returns:
        The assistant's text response.
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed. Run: pip install groq")

    client = Groq(api_key=settings.GROQ_API_KEY)

    # TRUNCATION REMOVED: Since the Pinecone Web-RAG pipeline ensures only
    # dense, highly-relevant ~1200 char chunks are passed, we can safely feed
    # a larger context window. Use up to 10 dense blocks for more comprehensive coverage.
    safe_blocks = context_blocks[:10]

    final_user_content = build_web_prompt(query, safe_blocks)

    messages = [{"role": "system", "content": WEB_SEARCH_SYSTEM_PROMPT}]

    if history:
        safe_history = []
        # Keep only the last 4 messages to save context limits
        for turn in history[-4:]:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                # Restrict memory of previous outputs
                if len(content) > 1000:
                    content = content[:1000] + "..."
                safe_history.append({"role": role, "content": content})
        messages.extend(safe_history)

    messages.append({"role": "user", "content": final_user_content})

    logger.info(
        "Sending web-search request to Groq (%s). History turns: %d, Context blocks: %d.",
        settings.GROQ_MODEL,
        len(safe_history) if history else 0,
        len(safe_blocks),
    )

    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=1200,
        top_p=0.9,
    )

    response_text = completion.choices[0].message.content
    logger.info("Groq web-search response received (%d chars).", len(response_text))
    return response_text
