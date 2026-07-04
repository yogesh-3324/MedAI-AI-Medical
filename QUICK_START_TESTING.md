# 🚀 MedAI Web Search - Quick Start Testing Guide

## What You Just Got

✅ **Backend**: Anti-hallucination filters + smart source extraction
✅ **Frontend**: Beautiful source display with clickable cards
✅ **Integration**: Sources flow from backend → display on frontend

---

## 5-Minute Test

### Step 1: Start Backend
```bash
cd backend
python main.py
```
Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Step 2: Start Frontend
```bash
cd frontend-2
npm run dev
```
Wait for: `http://localhost:5173`

### Step 3: Open Chat Page
- Go to http://localhost:5173
- Navigate to Chat page
- Login with your account

### Step 4: Enable Web Search
- Look for **"Web Search"** toggle (top/sidebar)
- Toggle it **ON** (should turn blue/green)

### Step 5: Ask Question
Type any of these queries:
```
"What is pembrolizumab?"
"Latest FDA drug approvals 2026?"
"What are the symptoms of metastatic melanoma?"
```

### Step 6: Check Results
Should see:
✅ Answer text with [Source 1] citations
✅ **📚 SOURCES (3)** header below
✅ Source cards in grid layout
✅ Each card clickable

### Step 7: Click a Source Card
- Hover over any card (should lift up)
- Click it
- New tab opens with source website

---

## What To Look For

### ✅ Good Signs (Everything Working)

```
Answer Text:
"Pembrolizumab is a monoclonal antibody [Source 1] that blocks 
PD-1 receptors [Source 1], approved by the FDA [Source 1] for 
melanoma in 2014 [Source 1] and later expanded to other 
indications [Source 2]."

📚 SOURCES (2)
┌────────────────────┐  ┌────────────────────┐
│[1] ↗️               │  │[2] ↗️               │
│FDA approval page   │  │NIH clinical info   │
│🌐 FDA.gov          │  │🌐 NIH.gov          │
└────────────────────┘  └────────────────────┘ ← All clickable!

Helper Text:
"Click any source to visit website for detailed reference"
```

### ❌ Bad Signs (Something Wrong)

| Sign | Problem | Fix |
|------|---------|-----|
| No sources shown | Web search not enabled | Toggle web search ON |
| Shows "Unable to find" | No relevant content found | Try different query |
| Cards not clickable | URL issue | Check console for errors |
| Broken layout (mobile) | CSS not loaded | Clear cache, refresh |
| Hallucinated numbers | Old code still running | Restart backend |

---

## Test Scenarios

### Scenario 1: Broad Question (Should Return Sources)

**Query**: "What is the latest treatment for lung cancer?"

**Expected**:
- ✓ Answer with citations
- ✓ 2-4 source cards
- ✓ Domains like NIH, FDA, PubMed
- ✓ Cards rendered in grid

**Action**: Click each source card → should open webpage

---

### Scenario 2: Niche/Non-existent Topic (Should Say "Can't Find")

**Query**: "What is the treatment for fake_disease_xyz_2025?"

**Expected**:
- ✓ Answer starts with "❌ Unable to find current information"
- ✓ No source cards shown
- ✓ Explains why (niche/not covered)
- ✓ Suggests reformulating question

**Why**: System correctly refused to hallucinate!

---

### Scenario 3: Numerical Data (Should Cite or Reject)

**Query**: "What are the phase 3 trial results for drug ABC?"

**Expected Options**:
- ✓ Answer: "Trial results not provided in retrieved sources"
- ✓ OR: "Trial efficacy: 68% [Source 1] based on 2024 data"
- ✓ Never: Made-up percentages without source

**This shows**: Anti-hallucination working!

---

### Scenario 4: Mobile View (Should Stack Nicely)

**Steps**:
1. Ask web search question (desktop)
2. Inspect with mobile emulator (F12 → device toolbar)
3. Observe source cards

**Expected**:
- ✓ Cards stack 1-2 columns
- ✓ All text visible, no overflow
- ✓ Cards still clickable
- ✓ Layout responsive

---

## Browser Developer Tools

### Check Network Tab
```
POST /api/chat/message

Response should include:
{
  "answer": "...[Source 1]...",
  "sources": [
    {"title": "...", "url": "..."},
    {"title": "...", "url": "..."}
  ]
}
```

### Check Console
Look for messages like:
```
✓ Web search mode initiated
✓ Retrieved X relevant context blocks
🔍 Web search mode initiated — query: ...
⚠️ Rejected X low-relevance chunks
```

### Check Elements (F12)
Click on a source card:
```html
<a href="https://fda.gov/..." 
   target="_blank" 
   rel="noopener noreferrer">
   FDA approval page
</a>
```

---

## Performance Check

### Timing Targets:

| Operation | Target | Actual |
|-----------|--------|--------|
| Web search request | <5s | [Should be 2-4s] |
| Answer generation | <2s | [Should be 1-3s] |
| Total response | <7s | [Should be 3-7s] |
| Source cards render | <500ms | [Should be instant] |
| Card animations | 60fps | [Should be smooth] |

Check timing in browser DevTools → Network tab

---

## Debugging Checklist

If something isn't working:

### Backend Not Working:
```bash
# 1. Check if running
curl http://localhost:8000/health

# 2. Check logs for errors
# Look for: ERROR | Exception | Traceback

# 3. Verify environment variables
# Check: GROQ_API_KEY set?

# 4. Restart
# Kill process: Ctrl+C
# Run again: python main.py
```

### Frontend Not Working:
```bash
# 1. Check if running
# Should see: http://localhost:5173 vite server

# 2. Clear cache
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# 3. Check browser console (F12)
# Look for red errors

# 4. Restart
# Kill: Ctrl+C
# Run: npm run dev
```

### Sources Not Showing:
```js
// In browser console:
localStorage // Check if saving properly
// Or: Open Network tab → see API response for "sources" field
```

### Sources Not Clickable:
```js
// Right-click source card → Inspect
// Check: href attribute contains valid URL
// Check: onclick handlers present
```

---

## Example Queries to Test

### Good Queries (Should Find Sources):

1. "What is pembrohumab treatment indication?"
2. "Latest FDA drug approvals for cancer 2026"
3. "Immunotherapy for melanoma clinical trials"
4. "What does pembrolizumab do?"
5. "NIH guidelines for lung cancer treatment"
6. "ASCO 2026 oncology trial results"
7. "FDA approval database for new drugs"
8. "What is evidence-based diabetes treatment?"

### Bad Queries (Should Say "Not Found"):

1. "What is fake_medicine_xyzabc treatment?"
2. "What are the results for trial_that_never_happened?"
3. "Details about disease_invented_in_2025?"
4. "Tell me about procedure_xyz_123?"

**Tip**: System should handle both gracefully!

---

## Common Issues & Fixes

### Issue: "Web search not working"

**Checklist**:
- [ ] Toggle shows Web Search is ON?
- [ ] Backend running? (curl localhost:8000)
- [ ] Check API response includes "sources" field?
- [ ] Browser console shows errors?

**Fix**:
```bash
# Restart both:
# Backend first:
cd backend
python main.py

# Then frontend:
cd frontend-2  
npm run dev
```

---

### Issue: "Sources showing but not clickable"

**Checklist**:
- [ ] Can you see source card text?
- [ ] Does it have [1] badge?
- [ ] Can you hover (does it lift)?

**Debug**:
```js
// In browser console:
document.querySelectorAll('a[href*="http"]').forEach(a => {
  console.log("Link:", a.href, "Clickable:", a.hostname)
})
```

**Fix**: 
- Check that src.url contains full URL (https://...)
- Verify not blocked by browser security settings

---

### Issue: "Hallucinated answer despite fixes"

**Checklist**:
- [ ] Did you restart backend after changes?
- [ ] Are you using latest code (npm/python)?
- [ ] Check backend logs for threshold value?

**Debug**:
```bash
# Backend logs should show:
# "✓ Web-RAG complete: X high-relevance chunks (threshold=0.68)"
# 
# Not: "... threshold=0.35"  ← Old code!
```

**Fix**: 
- Kill backend process: Ctrl+C
- Restart: python main.py
- Hard refresh frontend: Ctrl+Shift+R

---

## Success Indicators ✅

You'll know it's working when:

1. **Web Search Query** → Takes 3-7 seconds (fetching web)
2. **Answer Appears** → With [Source 1], [Source 2] citations  
3. **Source Cards** → Beautiful grid with 2-4 colored cards
4. **Each Card Shows** → Index number, title, domain icon
5. **Hover Effect** → Card lifts up with shadow
6. **Click Works** → Opens website in new tab
7. **Mobile Works** → Responsive grid (1-2 columns)
8. **Niche Queries** → Return honest "Unable to find" message
9. **Console Clean** → No red errors in DevTools

---

## Quick Reference

### Key Files to Check:

**If sources not showing**:
→ Check: `frontend-2/src/components/Chat/MessageBubble.jsx` line ~40

**If not filtering hallucinations**:
→ Check: `backend/services/web_rag_service.py` line ~103

**If sources not clickable**:
→ Check: `frontend-2/src/services/api.jsx` returns sources

**If animations not working**:
→ Check: `frontend-2/src/index.css` has sourceCardFadeIn keyframe

---

## Performance Baseline

First query should take:
- DuckDuckGo search: ~1s
- Page fetching: ~1-2s  
- Embedding: ~0.5s
- LLM generation: ~1-2s
- **Total: 3-6 seconds** ✓

Subsequent queries usually faster (caching).

---

## Examples of Good Output

### Example 1: Found Sources ✅
```
Q: "What is a checkpoint inhibitor?"

A: A checkpoint inhibitor (also called immune checkpoint 
inhibitor or ICI) is a type of immunotherapy [Source 1] drug 
that helps the immune system fight cancer [Source 1] by blocking 
proteins like PD-1 [Source 1] or CTLA-4 [Source 2]. Common 
examples include pembrolizumab [Source 1] and nivolumab [Source 2].

📚 SOURCES (2)
[Card 1: FDA.gov] [Card 2: NIH.gov]
```

### Example 2: Not Found ✅
```
Q: "What is treatment for fake_disease_xyz?"

A: ❌ Unable to find current information

I searched the web for information about 'What is treatment 
for fake_disease_xyz?' but could not find reliable, relevant 
sources to provide a factual answer.

Why this happens:
- The topic may be too new or niche for web coverage
- Search results didn't contain enough specific detail
- Information may not be publicly available online

Recommendation: Try reformulating your question with more 
specific details, or consult a healthcare professional.

[No source cards shown]
```

---

## That's It! 🎉

You're ready to test. Start backend, start frontend, and try a web search query!

**Questions?** Check the documentation files:
- `WEB_SEARCH_FIXES_COMPLETE.md` - Backend fixes
- `SOURCES_DISPLAY_GUIDE.md` - Frontend features  
- `MEDAI_COMPLETE_IMPLEMENTATION_SUMMARY.md` - Full overview
