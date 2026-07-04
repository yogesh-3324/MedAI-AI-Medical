"""
services/web_search_service.py  —  v3

SAG Pipeline with all failure modes addressed:
  1. Query Rewriting     — natural language -> 2-3 targeted search strings
  2. Multi-Query Search  — merge + deduplicate results across queries
  3. Authority Ranking   — fda.gov > oncology journals > general medical > PR > news
  4. Full Page Fetch     — 4000 char window per page (captures trial data)
  5. Follow-up Search    — if < 2 fda.gov blocks found, run a targeted FDA retry
  6. Temporal Queries    — "most recent"/"latest" triggers date-sorted queries
"""

import logging
import re
import time
from typing import Optional

logger = logging.getLogger(__name__)

# ── Search config ─────────────────────────────────────────────────────────────
MAX_RESULTS_PER_QUERY  = 5
FULL_PAGE_FETCH_COUNT  = 7    # fetch full text for top 7 results
MAX_PAGE_CHARS         = 4000 # large enough to capture trial result tables
PAGE_FETCH_TIMEOUT     = 7

# ── Authority ranking ─────────────────────────────────────────────────────────
# Lower score = higher priority
AUTHORITY_SCORES: dict[str, int] = {
    "fda.gov"              : 1,
    "nejm.org"             : 1, # Flattened: NEJM is just as authoritative as FDA for trials
    "thelancet.com"        : 1, # Flattened
    "asco.org"             : 1, # Flattened
    "ascopubs.org"         : 1, # Flattened
    "aacr.org"             : 1, # Flattened
    "esmo.org"             : 1, # Flattened
    "accessdata.fda.gov"   : 1,
    "drugs.com"            : 2,
    "nih.gov"              : 2,
    "pubmed.ncbi.nlm.nih.gov": 2,
    "targetedonc.com"      : 3,
    "cancertherapyadvisor.com": 3,
    "cancer.gov"           : 3,
    "medscape.com"         : 4,
    "webmd.com"            : 5,
}

# Temporal intent keywords that trigger date-ordered search queries
TEMPORAL_TERMS = {"most recent", "latest", "newest", "current", "last", "just approved",
                  "recently approved", "new approval"}


# ─── HTML & PDF Utilities ───────────────────────────────────────────────────────

def _strip_html(raw_html: str) -> str:
    """Remove HTML tags and decode entities."""
    text = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&nbsp;", " ").replace("&quot;", '"').replace("&#39;", "'"))
    return re.sub(r"\s+", " ", text).strip()

def _fetch_page_text(url: str, max_chars: int = 8000) -> Optional[str]:
    """
    HTTP-GET a URL and extract text from HTML or PDF.
    Extracts up to max_chars roughly to capture "Results" sections deep in registries.
    """
    try:
        import httpx
        from io import BytesIO
        try:
            import PyPDF2
        except ImportError:
            PyPDF2 = None
            
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        resp = httpx.get(url, timeout=12, follow_redirects=True, headers=headers)
        
        if resp.status_code != 200:
            return None
            
        content_type = resp.headers.get("content-type", "").lower()
        
        # 1. Handle PDF Extraction
        if "application/pdf" in content_type:
            if not PyPDF2:
                logger.warning("PyPDF2 not installed; cannot parse PDF URL: %s", url)
                return None
            try:
                reader = PyPDF2.PdfReader(BytesIO(resp.content))
                text = ""
                # Extract first 4 pages (usually covers full conference abstract)
                for i in range(min(4, len(reader.pages))):
                    page_text = reader.pages[i].extract_text()
                    if page_text:
                        text += page_text + "\n"
                
                text = re.sub(r"\s+", " ", text).strip()
                logger.info("PDF extraction successful: extracted %d chars from %s", len(text), url)
                return text[:max_chars] if text else None
            except Exception as e:
                logger.error("Error reading PDF %s: %s", url, e)
                return None
                
        # 2. Handle HTML Extraction
        elif "text/html" in content_type:
            text = _strip_html(resp.text)
            return text[:max_chars] if text else None
            
    except Exception as exc:
        logger.debug("Page fetch failed for %s: %s", url, exc)
    return None


# ─── Authority Ranking ─────────────────────────────────────────────────────────

def _get_authority_score(url: str) -> int:
    """
    Return a priority score for a URL.
    Lower = higher authority. Default 6 (lowest = news/PR/unknown).
    """
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return 6
    for known_domain, score in AUTHORITY_SCORES.items():
        if domain == known_domain or domain.endswith("." + known_domain):
            return score
    # Heuristic: URLs containing "press-release" or "newsroom" get lowest priority
    if any(kw in url.lower() for kw in ["press-release", "newsroom", "investor", "ir."]):
        return 7
    return 6


def _rank_by_authority(results: list[dict]) -> list[dict]:
    """
    Re-sort search results so high-authority sources (fda.gov, nih.gov, etc.)
    appear first in the context window passed to the LLM.
    Fixes: Problems 18 (authority ranking) and 19 (source hierarchy).
    """
    return sorted(results, key=lambda r: _get_authority_score(r.get("href", "")))


# ─── Query Rewriting ───────────────────────────────────────────────────────────

def _has_temporal_intent(query: str) -> bool:
    """Detect whether the query is asking for the most recent / latest item."""
    q_lower = query.lower()
    return any(term in q_lower for term in TEMPORAL_TERMS)


def _detect_intent(query: str) -> str:
    """Classify user query intent into CLINICAL_TRIAL, FDA_APPROVAL, or GENERAL."""
    q = query.lower()
    if any(k in q for k in ["trial", "asco", "esmo", "phase", "results", "efficacy", "overall survival", "pfs", "orr", "hazard ratio", "endpoint"]):
        return "CLINICAL_TRIAL"
    if any(k in q for k in ["fda", "approval", "approved", "indication"]):
        return "FDA_APPROVAL"
    return "GENERAL"


def _rewrite_queries(original_query: str, intent: str) -> list[str]:
    """
    Convert a natural-language query into targeted search strings using Intent Routing.
    """
    q = original_query.strip().rstrip("?.")

    fillers = [
        "what was", "what is", "what are", "what were",
        "can you tell me", "please tell me", "i want to know",
        "do you know", "could you", "include", "tell me about",
    ]
    q_clean = q.lower()
    for f in fillers:
        q_clean = q_clean.replace(f, "")
    q_clean = re.sub(r"\s+", " ", q_clean).strip()

    year_match  = re.search(r"\b(20\d{2})\b", q_clean)
    month_match = re.search(
        r"\b(january|february|march|april|may|june|july|august"
        r"|september|october|november|december)\b",
        q_clean, re.IGNORECASE
    )
    year     = year_match.group(1)  if year_match  else ""
    month    = month_match.group(1).capitalize() if month_match else ""
    date_str = f"{month} {year}".strip()

    temporal = _has_temporal_intent(original_query)

    queries = [q_clean] # Base query
    
    if intent == "CLINICAL_TRIAL":
        # Target conference and trial endpoints specifically without FDA bias
        queries.append(f"{q_clean} phase III trial efficacy results ORR PFS OS")
        if temporal and date_str:
            queries.append(f"most important oncology trial results {date_str} ASCO ESMO")
    
    elif intent == "FDA_APPROVAL":
        # FDA specific targeting
        queries.append(f"FDA new drug approval {date_str} site:fda.gov" if date_str else f"FDA new drug approval site:fda.gov {q_clean}")
        if temporal and date_str:
            queries.append(f"most recent FDA oncology drug approval {date_str}")
            
    else:
        # General backup
        queries.append(f"{q_clean} clinical data evidence")

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for qry in queries:
        key = qry.strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(qry.strip())

    logger.info("Intent '%s' -> Rewrote query into %d search strings: %s", intent, len(unique), unique)
    return unique


# ─── Core Search ──────────────────────────────────────────────────────────────

def _run_single_search(query: str, max_results: int = 3) -> list[dict]:
    """Run one DDGS text search. Returns list of {title, href, body} dicts."""
    try:
        from ddgs import DDGS
        time.sleep(0.4)
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        logger.info("DDGS '%s' -> %d results", query[:60], len(results))
        return results
    except Exception as exc:
        logger.error("DDGS search failed for '%s': %s", query[:60], exc)
        return []


def _multi_query_search(queries: list[str]) -> list[dict]:
    """
    Run multiple search queries, merge results, deduplicate by URL.
    Fixes: Problems 4 (recall), 20 (multi-doc synthesis).
    """
    seen_urls: set[str] = set()
    merged: list[dict] = []
    for q in queries:
        for r in _run_single_search(q):
            url = r.get("href", "").strip()
            if url and url not in seen_urls:
                seen_urls.add(url)
                merged.append(r)
    logger.info("Multi-query: %d unique results from %d queries", len(merged), len(queries))
    return merged


def _followup_fda_search(query: str, existing_urls: set[str]) -> list[dict]:
    """
    Targeted FDA-only follow-up search when primary retrieval doesn't surface
    enough high-authority sources.
    Fixes: Problems 14 (no follow-up), 21 (context sufficiency), 28 (missing-info recovery).
    """
    year_match  = re.search(r"\b(20\d{2})\b", query)
    month_match = re.search(
        r"\b(january|february|march|april|may|june|july|august"
        r"|september|october|november|december)\b",
        query, re.IGNORECASE
    )
    year  = year_match.group(1)  if year_match  else "2026"
    month = month_match.group(1) if month_match else ""

    # Highly specific FDA follow-up queries
    followup_queries = [
        f"site:fda.gov approved drugs {month} {year}".strip(),
        f"FDA novel drug approvals {month} {year} oncology cancer".strip(),
        f"site:fda.gov hematology oncology approval {year}",
    ]

    new_results: list[dict] = []
    for q in followup_queries:
        for r in _run_single_search(q, max_results=3):
            url = r.get("href", "").strip()
            if url and url not in existing_urls:
                existing_urls.add(url)
                new_results.append(r)
    logger.info("Follow-up search added %d new FDA results", len(new_results))
    return new_results


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def get_web_context(query: str) -> tuple[list[dict], list[dict]]:
    """
    SAG context retrieval pipeline — v3.

    Steps:
      1. Rewrite query into 2-3 targeted search strings
      2. Multi-query search + deduplication
      3. Authority-rank results (fda.gov first)
      4. Follow-up FDA search if fewer than 2 fda.gov results found
      5. Fetch full page text for top FULL_PAGE_FETCH_COUNT results
      6. Return context_blocks (for LLM) and sources (for UI chips)

    Returns:
        context_blocks : list[{title, url, content}]  — authority-ranked
        sources        : list[{title, url}]            — same order
    """
    intent = _detect_intent(query)
    
    # Step 1 — Query rewriting based on intent
    search_queries = _rewrite_queries(query, intent)

    # Step 2 — Multi-query search
    raw_results = _multi_query_search(search_queries)
    seen_urls   = {r.get("href", "") for r in raw_results}

    if not raw_results:
        logger.warning("No results from primary search. Query: %s", query[:80])
        return [], []

    # Step 3 — Authority ranking (Elevated sources pushed to front)
    raw_results = _rank_by_authority(raw_results)

    # Step 4 — Follow-up search ONLY if FDA intent is detected and fda.gov results are lacking
    if intent == "FDA_APPROVAL":
        fda_count = sum(1 for r in raw_results if "fda.gov" in r.get("href", ""))
        if fda_count < 2:
            logger.info("Only %d fda.gov result(s) found for FDA intent — running follow-up search", fda_count)
            followup = _followup_fda_search(query, seen_urls)
            if followup:
                followup_ranked = _rank_by_authority(followup)
                raw_results = followup_ranked + raw_results
                raw_results = _rank_by_authority(raw_results)

    # Step 5 — Build context blocks with deep page text (PDFs + 8000 char HTML)
    raw_context: list[dict] = []
    sources: list[dict] = []

    for i, result in enumerate(raw_results):
        title = result.get("title", "Unknown Source")
        url   = result.get("href", "")
        body  = result.get("body", "")

        full_text: Optional[str] = None
        # We increase FULL_PAGE_FETCH_COUNT because web_rag_service effectively filters noise
        if i < FULL_PAGE_FETCH_COUNT and url:
            full_text = _fetch_page_text(url)

        content = full_text if full_text else body
        if not content:
            continue

        raw_context.append({"title": title, "url": url, "content": content})
        sources.append({"title": title, "url": url})

    logger.info("Raw web context fetched: %d large pages | Filtering via Pinecone RAG...", len(raw_context))
    
    # Step 6 — Pass all raw web pages through RAG Pipeline for optimal chunking and noise elimination
    try:
        from services.web_rag_service import process_web_context_through_rag
        context_blocks = process_web_context_through_rag(query, raw_context)
    except Exception as e:
        logger.error("Web RAG chunking failed, falling back to raw body snippets... %s", e)
        # Deep fallback: just use the DDG snippets if Pinecone embedding randomly fails
        context_blocks = [{"title": b["title"], "url": b["url"], "content": b["content"][:300]} for b in raw_context]

    logger.info(
        "Final Web Context ready: %d tightly-filtered dynamic chunks | fda.gov blocks: %d | query: %s",
        len(context_blocks),
        sum(1 for b in context_blocks if "fda.gov" in b["url"]),
        query[:60]
    )
    return context_blocks, sources
