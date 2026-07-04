import logging
import uuid
import re
from typing import List, Dict, Any
from urllib.parse import urlparse

from services.pinecone_service import upsert_document_chunks, retrieve_similar_chunks, delete_session_namespace
from services.embedding_service import embed_texts, embed_query

logger = logging.getLogger(__name__)

def _chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> List[str]:
    """
    Very simple text chunker based on characters, roughly breaking at sentences or paragraphs.
    """
    if not text:
        return []
        
    text = re.sub(r'\s+', ' ', text).strip()
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        
        # If we have reached the end of the text
        if end >= len(text):
            chunks.append(text[start:])
            break
            
        # Try to find a good breaking point (period+space or space)
        # Search backwards from 'end' up to 'end - overlap'
        boundary = -1
        for sep in [". ", "? ", "! ", " "]:
            idx = text.rfind(sep, start, end)
            if idx != -1 and idx > start + overlap: # Ensure we move forward
                boundary = idx + len(sep)
                break
                
        if boundary == -1:
            boundary = end # Hard break if no separator found
            
        chunks.append(text[start:boundary])
        start = boundary - overlap
        
    return chunks

def _calculate_dynamic_threshold(query: str) -> float:
    """
    Intelligent threshold selection based on query characteristics.
    
    Complex/interpretive queries need lower thresholds to avoid false negatives.
    Simple factual queries can use higher thresholds for precision.
    
    Returns: Relevance score threshold (0.0-1.0)
    """
    query_lower = query.lower()
    query_length = len(query)
    
    # Keywords indicating interpretive/explanatory questions
    interpretive_keywords = ["why", "how", "what does", "means", "caused", "reason", "effect", "consequence"]
    # Keywords indicating specific events/news
    event_keywords = ["retracted", "withdrawn", "announced", "approved", "denied", "rejected", "failed", "abandoned"]
    # Keywords for research/clinical interest
    research_keywords = ["study", "trial", "research", "clinical", "results", "outcome", "efficacy"]
    
    # Check query characteristics
    has_interpretive = any(kw in query_lower for kw in interpretive_keywords)
    has_event = any(kw in query_lower for kw in event_keywords)
    has_research = any(kw in query_lower for kw in research_keywords)
    
    # Determine threshold based on characteristics
    if has_event or has_interpretive:
        # Event-based or interpretive questions need more flexibility
        # Semantic matching may be looser when asking "why" vs "what is"
        return 0.60
    elif has_research and query_length > 70:
        # Long research questions with interpretive elements
        return 0.62
    elif query_length > 100:
        # Very detailed/complex queries
        return 0.64
    elif query_length < 25:
        # Very short, simple queries (higher precision needed)
        return 0.70
    else:
        # Standard queries
        return 0.68


def _get_source_authority_score(url: str) -> int:
    """
    Return a small integer priority for a source URL.
    Lower = higher authority. This helps promote official medical sources.
    """
    try:
        domain = urlparse(url).netloc.lower().lstrip("www.")
    except Exception:
        return 6

    authoritative_domains = {
        "fda.gov": 1,
        "accessdata.fda.gov": 1,
        "nih.gov": 1,
        "pubmed.ncbi.nlm.nih.gov": 1,
        "nejm.org": 1,
        "thelancet.com": 1,
        "asco.org": 1,
        "ascopubs.org": 1,
        "aacr.org": 1,
        "esmo.org": 1,
        "cancer.gov": 1,
        "nature.com": 2,
        "jamanetwork.com": 2,
        "drugs.com": 3,
        "medscape.com": 4,
        "webmd.com": 5,
    }

    for known_domain, score in authoritative_domains.items():
        if domain == known_domain or domain.endswith('.' + known_domain):
            return score

    if any(kw in url.lower() for kw in ["press-release", "newsroom", "investor", "ir."]):
        return 7

    return 6


def process_web_context_through_rag(query: str, raw_context_blocks: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Takes complete scraped webpages/PDFs, chunks them, embeds them into Pinecone, 
    retrieves the top-K chunks highly relevant to the query, and deletes the namespace.
    
    Returns: A list of tightly filtered context blocks for the LLM.
    """
    if not raw_context_blocks:
        return []
        
    session_namespace = f"web_rag_{uuid.uuid4().hex[:12]}"
    logger.info("Initializing Ephemeral Web-RAG namespace: %s", session_namespace)
    
    chunks = []
    chunk_sources = [] # Maps chunk index back to the source URL and Title
    
    # 1. Chunk all scraped pages
    for block in raw_context_blocks:
        title = block.get("title", "Unknown Source")
        url = block.get("url", "")
        content = block.get("content", "")
        
        page_chunks = _chunk_text(content, chunk_size=1200, overlap=250)
        for pc in page_chunks:
            chunks.append(pc)
            chunk_sources.append({"title": title, "url": url})
            
    if not chunks:
        return []
        
    logger.info("Created %d sub-chunks from %d web sources.", len(chunks), len(raw_context_blocks))
    
    # 2. Embed all chunks
    try:
        embeddings = embed_texts(chunks)
    except Exception as e:
        logger.error("Failed to embed web chunks: %s", e)
        return []
        
    # 3. Upsert to Pinecone
    try:
        upsert_document_chunks(chunks, embeddings, session_namespace, "live_web_search")
    except Exception as e:
        logger.error("Failed to upsert to Pinecone namespace %s: %s", session_namespace, e)
        return []
        
    # 4. Embed Query & Retrieve Top K
    filtered_results = []
    try:
        q_emb = embed_query(query)
        top_k = min(16, len(chunks))  # Retrieve a larger set for better ranking
        results = retrieve_similar_chunks(q_emb, session_namespace, top_k=top_k)
        
        # DYNAMIC THRESHOLD: Adjust based on query characteristics
        RELEVANCE_THRESHOLD = _calculate_dynamic_threshold(query)
        logger.info("🎯 Dynamic threshold set to %.2f for query: %s", RELEVANCE_THRESHOLD, query[:70])
        
        rejected_chunks = []
        for r in results:
            idx = r.get("chunk_index", -1)
            score = float(r.get("score", 0.0))
            
            if idx == -1:
                continue

            source_meta = chunk_sources[idx]
            source_url = source_meta.get("url", "")
            source_title = source_meta.get("title", "Unknown Source")
            authority_score = _get_source_authority_score(source_url)
            
            if score >= RELEVANCE_THRESHOLD:
                filtered_results.append({
                    "title": source_title,
                    "url": source_url,
                    "content": r.get("text", ""),
                    "relevance_score": round(score, 3),
                    "authority_score": authority_score,
                })
            else:
                rejected_chunks.append((score, len(r.get("text", "")), source_title))
        
        if rejected_chunks:
            logger.info("⚠️  Rejected %d low-relevance chunks (score < %.2f):", len(rejected_chunks), RELEVANCE_THRESHOLD)
            for score, text_len, title in rejected_chunks[:3]:
                logger.info("   - %s: score=%.3f, len=%d chars", title, score, text_len)

        # Group by source URL to avoid unrelated pages dominating with a single chunk
        source_groups: Dict[str, Dict[str, Any]] = {}
        for item in filtered_results:
            source = source_groups.setdefault(item["url"], {
                "title": item["title"],
                "url": item["url"],
                "authority_score": item["authority_score"],
                "best_score": 0.0,
                "total_score": 0.0,
                "chunks": [],
            })
            source["chunks"].append(item)
            source["best_score"] = max(source["best_score"], item["relevance_score"])
            source["total_score"] += item["relevance_score"]
            source["authority_score"] = min(source["authority_score"], item["authority_score"])

        sorted_sources = sorted(
            source_groups.values(),
            key=lambda s: (s["authority_score"], -s["best_score"], -s["total_score"]),
        )

        filtered_blocks = []
        for source in sorted_sources:
            source["chunks"].sort(key=lambda c: -c["relevance_score"])
            for chunk in source["chunks"][:2]:
                filtered_blocks.append({
                    "title": source["title"],
                    "url": source["url"],
                    "content": chunk["content"],
                    "relevance_score": chunk["relevance_score"],
                    "authority_score": source["authority_score"],
                })
                if len(filtered_blocks) >= 10:
                    break
            if len(filtered_blocks) >= 10:
                break

        if not filtered_blocks and filtered_results:
            # fallback: keep the top 8 chunks by raw relevance if filtering was too aggressive
            filtered_blocks = sorted(filtered_results, key=lambda x: -x["relevance_score"])[:8]

        logger.info(
            "✓ Web-RAG complete: %d selected chunks from %d source groups (threshold=%.2f) | query: %s",
            len(filtered_blocks),
            len(sorted_sources),
            RELEVANCE_THRESHOLD,
            query[:60],
        )
    except Exception as e:
        logger.error("Failed querying Pinecone web context: %s", e)
    finally:
        # 5. Cleanup
        delete_session_namespace(session_namespace)
        
    return filtered_blocks
