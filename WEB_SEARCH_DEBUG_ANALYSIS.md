# MedAI Web Search Feature - Issues & Root Cause Analysis

## Critical Issues Found

### 1. **Overly Low Relevance Score Threshold (0.35)**
- **Location**: `backend/services/web_rag_service.py`, line 105
- **Issue**: Chunks with similarity score > 0.35 are accepted as relevant. This is too lenient.
- **Impact**: Low-relevance chunks get included, LLM has noisy context and may hallucinate
- **Fix**: Increase threshold to 0.65+ (modern embedding models: >0.7 is high relevance)

### 2. **Empty Context Not Explicitly Handled**
- **Location**: `backend/services/groq_service.py`, `build_web_prompt()` function
- **Issue**: When no results are found, the prompt says "LIVE WEB SEARCH RESULTS" but shows nothing
- **Impact**: LLM gets confusing prompt, may fill gaps with pre-training data (hallucination)
- **Fix**: Add explicit check: if no context blocks, return "I could not find current information about this query"

### 3. **No Minimum Context Validation**
- **Location**: `backend/services/web_rag_service.py`, entire function
- **Issue**: Even if only 1-2 low-relevance chunks exist, they're passed to LLM
- **Impact**: LLM forced to answer based on barely-relevant data
- **Fix**: Require minimum context relevance & minimum chunk count before proceeding

### 4. **Inconsistent Score Interpretation**
- Authority scores (0=highest, 10=lowest) vs Semantic scores (0=lowest, 1=highest)
- Can cause confusion in filtering logic
- **Fix**: Add clear documentation, use separate score types

### 5. **Missing "No Results Found" Response Path**
- **Location**: `backend/services/rag_service.py`, `answer_query_with_web_search()`
- **Issue**: When web search returns no relevant context, the function doesn't explicitly tell the user
- **Impact**: User sees hallucinated answer instead of honest "no information found"
- **Fix**: Add explicit check: if context_blocks is empty after filtering, return honest response

### 6. **No Relevance Filtering Between Web Search & RAG**
- **Location**: `backend/services/web_search_service.py`, `get_web_context()`
- **Issue**: Web snippets from DDG are passed through RAG, but no check if ANY were relevant
- **Impact**: Can return empty context to LLM with web search still "enabled"
- **Fix**: Add check-point: if RAG returns 0 chunks, explicitly tell LLM no context available

### 7. **Prompt Wording Doesn't Account for Missing Information**
- **Location**: `backend/services/groq_service.py`, `build_web_prompt()`
- **Issue**: System prompt assumes context blocks exist; doesn't handle "no sources available" case
- **Impact**: LLM instructions don't match scenario when context is empty
- **Fix**: Modify prompt to branch based on whether context_blocks is empty

---

## Recommended Fixes (Priority Order)

### HIGH PRIORITY (Fix First - Prevents Hallucination)
1. Increase relevance score threshold from 0.35 → 0.68
2. Add explicit "no context found" response in `answer_query_with_web_search()`
3. Add minimum context validation before calling LLM

### MEDIUM PRIORITY (Improves Accuracy)
4. Add logging when chunks are filtered out by relevance
5. Return clear sources attribution
6. Add relevance score display for debugging

### LOW PRIORITY (Polish)
7. Update system prompt to handle empty context
8. Add user-facing notice when falling back to pre-training knowledge

---

## Testing Scenarios After Fix

1. **Query with no relevant results**: Should return "I couldn't find current information..."
2. **Query with low-relevance results**: Should not include borderline chunks
3. **Query with good results**: Should cite sources and maintain factual accuracy
4. **Multi-part medical question**: Should cite which source answers which part
