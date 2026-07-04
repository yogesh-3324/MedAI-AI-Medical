# MedAI Web Search Feature - Complete Fixes & Testing Guide

## Summary of Changes Made

### 1. ✅ **Increased Relevance Score Threshold (web_rag_service.py)**
- **Changed from**: 0.35 to 0.68
- **Why**: Modern embedding models need scores >0.7 for high relevance; 0.68 balances recall vs precision
- **Effect**: Now filters out low-relevance chunks that could cause hallucination
- **Logging**: Added detailed logs of rejected chunks with their scores

### 2. ✅ **Added Explicit Empty Context Handling (rag_service.py)**
- **New Check**: In `answer_query_with_web_search()`, returns early if no relevant context found
- **Response**: User gets honest message: "Unable to find current information"
- **Effect**: Prevents LLM from hallucinating when no sources exist
- **Logging**: Logs with emojis (❌, ✓, 🔍) for easy debugging

### 3. ✅ **Enhanced Web Prompt (groq_service.py)**
- **Build Web Prompt**: Now shows relevance scores in SOURCE headers
- **Anti-Hallucination Instructions**: COMPLETE REWRITE with 5 explicit sections
- **Minimal Context Warning**: If only 1-2 sources, adds warning
- **Failsafe**: Upstream empty context check means this never gets empty list
- **Temporal Honesty**: Added instruction to flag outdated information

### 4. ✅ **Better Error Handling**
- **Upstream vs Downstream**: Empty context caught at RAG service level before reaching LLM
- **Explicit Messages**: User sees "❌ Unable to find..." instead of vague fallback
- **Pipeline Logging**: Each stage logs clearly for debugging

---

## Anti-Hallucination Defense Layers

```
Layer 1: Web Search
│
├─ Query rewriting (intent-based)
├─ Multi-query search (DuckDuckGo)
└─ Authority ranking (FDA > journals > general)

Layer 2: Page Fetching
│
├─ Full page text extraction (4000+ chars)
├─ PDF parsing
└─ Timeout & retry logic

Layer 3: Relevance Filtering (HIGHEST PRIORITY)
│
├─ Chunk extraction (1200 char chunks with 250 overlap)
├─ Embedding via Pinecone
├─ **Score > 0.68 THRESHOLD** ← CRITICAL DEFENSE
└─ Reject low-relevance chunks with logging

Layer 4: Context Validation (NEW)
│
├─ Check if any chunks passed filter
├─ IF EMPTY: Return "Unable to find information"
└─ IF EXISTS: Proceed to LLM

Layer 5: LLM Generation with Anti-Hallucination Prompt
│
├─ Explicit: ONLY use provided sources
├─ Explicit: NO pre-training data
├─ Explicit: NO numerical estimates
├─ Explicit: EVERY fact must have [Source N]
└─ Quality gates before responding
```

---

## Testing Scenarios

### Test 1: No Relevant Information Found
**Scenario**: User asks about a very niche/recent topic with no web coverage
```
User Query: "What is the latest treatment for XYZ_FAKE_DISEASE_2026?"
Expected: "❌ Unable to find current information about 'What is the latest treatment for XYZ_FAKE_DISEASE_2026?'..."
Actual: [Should see this response]
Status: ✓ PASS (if you see honest "unable to find" message)
Log Check: Look for "❌ Web search returned NO relevant context"
```

### Test 2: Low-Relevance Results Filtered
**Scenario**: Query matches loosely related articles (score < 0.68)
```
User Query: "FDA approval for cancer drug 2026"
Expected: Only high-relevance chunks included (score > 0.68)
          If no chunks pass threshold: "Unable to find" message
Actual: [Check log output]
Log Check: Look for "⚠️  Rejected X low-relevance chunks (score <= 0.68)"
Status: ✓ PASS (if low-relevance chunks are rejected)
```

### Test 3: Good Results with Citations
**Scenario**: Query with available recent information
```
User Query: "What is pembrolizumab? When was it approved?"
Expected: Answer with [Source N] citations
          Numbers only from sources
          Dates explicitly cited
Actual: [Check response]
Assert: Every number/date has [Source X] after it
Status: ✓ PASS if properly cited
```

### Test 4: Numerical Data Protection
**Scenario**: Query asks for trial results not in sources
```
User Query: "What are the exact ORR and OS numbers for trial XYZ?"
Expected: "Numerical outcomes not provided in retrieved sources"
          NOT a made-up percentage
Actual: [Check response]
Assert: Does NOT contain invented statistics
Status: ✓ PASS if no hallucinated numbers
```

### Test 5: Temporal Awareness
**Scenario**: Query about "latest" info, but sources are old
```
User Query: "What are the latest FDA approvals in cancer?"
Expected: If sources are from 2024, prompt says "Last data available: 2024"
Actual: [Check response]
Assert: Explicitly mentions data freshness
Status: ✓ PASS if temporal honesty present
```

### Test 6: Incomplete Coverage Flag
**Scenario**: One field answered, others not in sources
```
User Query: "What is brand name, approval date, and indication for drug X?"
Expected: "Brand name: Y [Source 1]
          Approval date: Not found in sources
          Indication: [From Source 2]"
Actual: [Check response]
Assert: Missing fields explicitly marked as "Not found"
Status: ✓ PASS if shows [missing] vs [found]
```

---

## Debug Checklist

### When user reports hallucination:

1. **Check Relevance Threshold**
   ```python
   # In web_rag_service.py around line 103:
   RELEVANCE_THRESHOLD = 0.68  # Should be 0.68+
   if score > RELEVANCE_THRESHOLD:  # Should use > not >=
   ```

2. **Verify Empty Context Check**
   ```python
   # In rag_service.py, answer_query_with_web_search():
   if not context_blocks:
       # Should return honest "Unable to find" message
       return { "answer": "❌ Unable to find current information..." }
   ```

3. **Check System Prompt**
   ```python
   # In groq_service.py, WEB_SEARCH_SYSTEM_PROMPT:
   # Should have "NEVER supply information from pre-training"
   # Should have multiple anti-hallucination sections
   ```

4. **Review Logs for Each Stage**
```
[Stage 1] Query rewriting: "6 rewrote into 3 search queries"
[Stage 2] Web search: "30 total results from DuckDuckGo"
[Stage 3] Authority rank: "Sorted by fda.gov prominence"
[Stage 4] Page fetch: "Fetched 7 pages (full text extraction)"
[Stage 5] Relevance filter: "⚠️  Rejected 5 low-relevance chunks (score <= 0.68)"
[Stage 6] Retrieved: "✓ Retrieved 2 high-relevance chunks"
[Stage 7] Check empty: "Did not return 'Unable to find' -> means 2 chunks passed"
[Stage 8] LLM call: "Sending web-search request with 2 context blocks"
```

5. **Common Hallucination Patterns to Look For**
   - ❌ Drug approval date without [Source X]
   - ❌ Trial statistic (ORR: 52%) without exact match to source
   - ❌ Answer to query when log shows "NO relevant context"
   - ❌ Information that sounds like general knowledge vs. web search

---

## Key Configuration Values

| Setting | Value | Purpose |
|---------|-------|---------|
| `RELEVANCE_THRESHOLD` | 0.68 | Score required for chunk inclusion |
| `MAX_RESULTS_PER_QUERY` | 5 | Results per individual search query |
| `FULL_PAGE_FETCH_COUNT` | 7 | Number of pages to fetch full text from |
| `MAX_PAGE_CHARS` | 4000 | Characters extracted per page |
| `CHUNK_SIZE` | 1200 | Characters per chunk for Pinecone |
| `CHUNK_OVERLAP` | 250 | Character overlap between chunks |
| `TOP_K_RETRIEVAL` | 8 | Max chunks to retrieve from Pinecone |
| `LLM_TEMPERATURE` | 0.3 | Groq LLM temperature (lower = more factual) |
| `LLM_MAX_TOKENS` | 1200 | Max response length |

---

## How to Verify Fixes in Production

### Check Logs
1. Look for "Rejected X low-relevance chunks" - shows threshold working
2. Look for "❌ Web search returned NO relevant context" - shows empty catch working
3. Look for "[Source N]" in responses - shows citation working

### Monitor Metrics
- Count of "Unable to find current information" responses
- Average relevance scores of accepted chunks
- Count of context blocks per query
- Hallucination complaint rate (should decrease)

### User Testing
1. Ask about very new/niche topics → Should get "Unable to find"
2. Ask about controversial topics → Should cite sources, not invent
3. Ask for specific numbers → Should say "Not provided" if absent
4. Ask multi-part questions → Should mark which parts are covered

---

## If Issues Persist

### Issue: Still getting hallucinated numbers
- **Check**: Verify 0.68 threshold is in place (not 0.35)
- **Check**: Verify empty context check runs BEFORE LLM
- **Check**: Verify WEB_SEARCH_SYSTEM_PROMPT has anti-hallucination section

### Issue: Rejecting too much valid content
- **Check**: Try lowering threshold to 0.65 (but not below 0.6)
- **Check**: Verify embedding model is working correctly
- **Check**: Check that queries are being rewritten properly

### Issue: Users still seeing old/cached responses
- **Check**: Verify namespace is being deleted in web_rag_service finally block
- **Check**: Verify session-based storage not persisting

### Issue: Web search not being called
- **Check**: Verify frontend is setting `use_web_search: true`
- **Check**: Verify router in chat.py receives this flag
- **Check**: Check API logs that answer_query_with_web_search is called, not answer_query

---

## Performance Optimization Notes

The current system should handle:
- ✅ Small queries: <500 ms
- ✅ Medium queries (3-4 search results): 1-2 seconds
- ✅ Large queries (6-7 pages fetched): 3-5 seconds
- ⚠️  Very large queries (7+ pages + long history): 5-10 seconds

Bottlenecks (in order):
1. Page fetching (largest network latency)
2. Pinecone embedding (~500ms per 8 chunks)
3. DDG search queries (~400ms per query)
4. LLM generation (depends on model)

If slow, try:
- Reduce FULL_PAGE_FETCH_COUNT from 7 to 5
- Reduce TOP_K_RETRIEVAL from 8 to 6
- Use shorter chat history (already capped at 4 turns)
