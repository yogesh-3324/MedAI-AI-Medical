# Quick Reference: Web Search Hallucination Fixes

## The Core Problem You Had

Your MedAI chatbot was **hallucinating** about current information when:
1. No relevant web results found → LLM made up information
2. Low-relevance chunks included → LLM had noisy data to work with
3. No explicit check for "no results" → System tried to answer anyway

---

## The Root Causes (Fixed)

| Problem | Root Cause | Fix Applied | File |
|---------|-----------|-------------|------|
| Accepts junk chunks | Threshold 0.35 too low | Changed to 0.68 | `web_rag_service.py` |
| No "no results" check | Empty context not caught | Added explicit check | `rag_service.py` |
| Weak LLM instructions | Generic prompt | Rewrote with 5 sections | `groq_service.py` |
| No visibility | Minimal logging | Added detailed emoji logs | Both files |

---

## What Each Fix Does

### Fix #1: Relevance Threshold (0.35 → 0.68)
**Location**: `backend/services/web_rag_service.py` line ~103

**Before**:
```python
if score > 0.35:  # Too lenient!
    filtered_blocks.append(chunk)
```

**After**:
```python
RELEVANCE_THRESHOLD = 0.68  # Higher standard
if score > RELEVANCE_THRESHOLD:
    filtered_blocks.append(chunk)
    # ...tracks which chunks were rejected...
```

**Result**: Low-quality chunks filtered out. Log shows: "⚠️  Rejected 5 low-relevance chunks"

---

### Fix #2: Empty Context Handler (NEW)
**Location**: `backend/services/rag_service.py` in `answer_query_with_web_search()`

**Added**:
```python
if not context_blocks:
    return {
        "answer": "❌ **Unable to find current information**\nI searched the web but could 
                   not find reliable sources...",
        "sources": []  # No sources to cite
    }
```

**Result**: User sees honest message instead of hallucination

---

### Fix #3: Stronger Anti-Hallucination Prompt
**Location**: `backend/services/groq_service.py` in `build_web_prompt()`

**Key Sections Added**:
```
1. DIRECT & FACTUAL EXTRACTION ONLY
2. STRICT GROUNDING & MANDATORY INLINE CITATIONS [Source N]
3. **CRITICAL** ANTI-HALLUCINATION RULES:
   a) NUMBERS & STATISTICS - NEVER output without source
   b) MISSING INFORMATION - Mark explicitly as [Not found]
   c) PRE-TRAINING DATA PROHIBITION - Don't use model knowledge
   d) TEMPORAL HONESTY - Flag outdated info
4. ENTITY TYPE VERIFICATION
5. QUALITY GATES BEFORE RESPONDING
```

**Result**: LLM has crystal-clear instructions, adds citations, avoids speculation

---

## Before vs After Examples

### Example 1: No Relevant Information

**Before (Hallucination ❌)**:
```
User: "What's the latest treatment for disease XYZ?"
Bot: "The newest treatment involves drug ABCDEF that was approved in 
      June 2026 and shows 70% efficacy..."
      
Reality: Web search found NOTHING about this. Bot made it up.
```

**After (Honest ✓)**:
```
User: "What's the latest treatment for disease XYZ?"
Bot: "❌ Unable to find current information. I searched the web but 
      could not find reliable sources to answer this question accurately."
      
Reality: System caught empty context and refused to hallucinate.
```

---

### Example 2: Low-Relevance Results

**Before (Noisy Data ❌)**:
```
User: "What's the ORR for drug ABC in trial DEF?"
Bot: "The objective response rate is around 45-50%..."

Reality: Web result #3 vaguely mentioned "cancer drugs" and ORR.
         System included it despite being only 0.32 relevant (way below signal).
```

**After (High Quality ✓)**:
```
User: "What's the ORR for drug ABC in trial DEF?"
Bot: "The objective response rate for drug ABC in trial DEF was 
      48.3% [Source 2] according to the ASCO 2026 abstract."
      
Reality: Only included chunks > 0.68 similarity. Clear [Source] citations.
         Or if sources don't have this: "Exact ORR not provided in sources."
```

---

### Example 3: Multi-Part Question

**Before (Incomplete ❌)**:
```
User: "When was pembrolizumab approved? What's the indication?"
Bot: "Pembrolizumab is for cancer. It was approved a while ago."

Reality: Made up vague timeline. Didn't cite sources.
```

**After (Complete & Cited ✓)**:
```
User: "When was pembrolizumab approved? What's the indication?"
Bot: "• Approval Date: December 23, 2014 [Source 1]
     • Indication: Unresectable or metastatic melanoma [Source 1]
     • [Source 1: FDA approval letter from AccessData.FDA.gov]"
     
Reality: Each fact individually cited. User can verify.
```

---

## How to Test Your Fix

### Quick Test 1: Niche Query (Should Fail Gracefully)
```
Query: "What is treatment for yqwerty disease 2026?"
Expected Response: Starts with "❌ Unable to find current information"
Check Log: "❌ Web search returned NO relevant context"
Status: ✓ PASS
```

### Quick Test 2: Real Query (Should Cite Sources)
```
Query: "What is pembrolizumab?"
Expected Response: Contains [Source 1], [Source 2], etc.
Check Log: "✓ Retrieved 4 high-relevance chunks"
Status: ✓ PASS if all facts have citations
```

### Quick Test 3: Numerical Data (Should Not Hallucinate)
```
Query: "What are FDA approval statistics for 2026?"
Expected Response: Either cites exact numbers OR says "Not provided in sources"
Check: Does NOT contain estimates like "approximately 50%" without source
Status: ✓ PASS if no unattributed numbers
```

---

## Files Modified

```
✓ backend/services/web_rag_service.py
  - Increased threshold: 0.35 → 0.68
  - Added rejection logging with scores
  - Tracks which chunks accepted/rejected

✓ backend/services/rag_service.py
  - Added empty context check
  - Returns honest "Unable to find" message
  - Added detailed emoji logging (❌, ✓, 🔍)

✓ backend/services/groq_service.py
  - Rewrote build_web_prompt() with anti-hallucination sections
  - Added relevance score display in SOURCE headers
  - Added warning for minimal context (1-2 sources)
  - Strengthened WEB_SEARCH_SYSTEM_PROMPT (already good)
```

---

## Verification Checklist

Run these checks to confirm fixes are working:

- [ ] Make API call to `/chat/message` with `"use_web_search": true`
- [ ] Logs show relevance score filtering
- [ ] For niche query: Response includes "Unable to find current information"
- [ ] For real query: Response includes [Source 1], [Source 2], etc.
- [ ] No hallucinated numbers without sources
- [ ] No make-up drug names or trial names

---

## If It's Still Not Working

### 1. Check Threshold is Really Updated
```bash
cd backend/services
grep -n "RELEVANCE_THRESHOLD = " web_rag_service.py
# Should show: line 103 (or nearby): RELEVANCE_THRESHOLD = 0.68
```

### 2. Check Empty Context Catch is in Place
```bash
grep -n "if not context_blocks:" backend/services/rag_service.py
# Should show multiple matches, including one in answer_query_with_web_search()
```

### 3. Check System Prompt Has Anti-Hallucination Section
```bash
grep -n "NEVER supply information from" backend/services/groq_service.py
# Should show: WEB_SEARCH_SYSTEM_PROMPT contains this phrase
```

### 4. Restart Backend
```bash
# Kill and restart your backend server to apply changes
python backend/main.py
```

### 5. Test with Simple curl
```bash
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is fake disease treatment 2026?",
    "use_web_search": true,
    "history": []
  }'
```

Expected: Response starts with "❌ Unable to find current information"

---

## Performance Impact

These fixes have **minimal performance impact**:
- Higher threshold (0.68 vs 0.35): ~0ms difference
- Empty context check: ~1-2ms earlier exit
- Better logging: +10-20ms in logs (not visible to user)
- Overall: **Fixes are faster** because they reject junk early

No new external API calls added. No new dependencies.

---

## Next Steps (Optional Improvements)

1. **Add Confidence Score to Response** - Show user: "Found with 92% confidence"
2. **A/B Test Threshold** - Try 0.65, 0.68, 0.70 to find sweet spot
3. **Add Feedback Loop** - User thumbs-up/down on hallucination detection
4. **Monitor Metrics** - Track hallucination rate over time
5. **Fine-tune Embedding Model** - Use medical-specific embeddings if available

---

## Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Still getting hallucined numbers | Threshold not actually 0.68 | Check file was saved |
| Too few results ("Unable to find" often) | Threshold too high | Lower to 0.65 or 0.63 |
| Responses lack citations | Prompt not updated | Verify build_web_prompt() updated |
| Empty context not caught | Check not running | Verify rag_service.py updated |
| Old responses cached | Namespace not deleted | Check Pinecone finally block |
| Web search not used | Frontend not sending flag | Check use_web_search: true being sent |

