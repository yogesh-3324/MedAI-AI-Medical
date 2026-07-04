# MedAI Web Search Architecture - Visual Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                           🤖 MedAI Chatbot                                  │
│                                                                             │
│  ┌────────────────────────────┐          ┌────────────────────────────┐   │
│  │   FRONTEND (React)         │          │   BACKEND (FastAPI)        │   │
│  ├────────────────────────────┤          ├────────────────────────────┤   │
│  │                            │          │                            │   │
│  │  Chat Page                 │◄────────►│  RAG Service               │   │
│  │    ↓                       │          │    Orchestrator            │   │
│  │  Chat Input                │          │                            │   │
│  │    ↓                       │          │  Web Search Service        │   │
│  │  [Web Search Toggle] ◄────┼──────────┼─► Query Rewriting          │   │
│  │    ↓                       │          │    Multi-Query Search      │   │
│  │  API Call                  │          │    Authority Ranking       │   │
│  │    ↓                       │          │    Page Fetching           │   │
│  │  Store Message + Sources   │          │                            │   │
│  │    ↓                       │          │  Web RAG Service           │   │
│  │  MessageBubble             │          │    Chunking & Embedding    │   │
│  │    ├─ Answer Text          │          │    Pinecone Storage        │   │
│  │    ├─ [Source N] Citations │          │    RELEVANCE FILTER (0.68) │   │
│  │    └─ Source Cards Grid◄───┼──────────┼─► Groq LLM Generation      │   │
│  │       [1][2][3]...         │          │                            │   │
│  │       Click to visit       │          │  Response with sources     │   │
│  │                            │          │    {"answer": "...",       │   │
│  │  S1: FDA.gov ───────────┐  │          │     "sources": [...]}      │   │
│  │  S2: NIH.gov ────┐      │  │          │                            │   │
│  │  S3: PubMed ──┐  │      │  │          └────────────────────────────┘   │
│  │              │  │      └──┼──────────► External Websites               │
│  │              └──┼─────────┼────────────(FDA.gov, NIH.gov, PubMed)     │
│  │                 │         │                                            │
│  └────────────────┼─────────┼────────────────────────────────────────────┘
│                   │         │
│                User clicks  Opens in new tab
│                to verify    for fact-checking
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Request/Response Flow

### Normal Web Search Request

```
1. FRONTEND (Browser)
   ┌──────────────────────────────┐
   │ User Input: "Tell me about   │
   │ pembrolizumab"               │
   │                              │
   │ Web Search: [Toggle ON] ✓    │
   └──────────────┬───────────────┘
                  │ POST /api/chat/message
                  │ {
                  │   "message": "Tell me about pembrolizumab",
                  │   "use_web_search": true,
                  │   "history": [...]
                  │ }
                  ↓
   
2. BACKEND - Web Search Pipeline
   ┌──────────────────────────────────────────────────┐
   │ A. Query Rewriting                              │
   │    Input:  "Tell me about pembrolizumab"        │
   │    Output: [                                    │
   │      "pembrolizumab drug mechanism action",     │
   │      "pembrolizumab FDA approval indication",   │
   │      "pembrolizumab clinical trial results"     │
   │    ]                                            │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ B. Multi-Query Search (DuckDuckGo)              │
   │    3 queries → ~15 total results               │
   │    Results ranked by authority                 │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ C. Page Fetching                                │
   │    Fetch top 7 pages (full text extraction)     │
   │    Convert PDF if needed                        │
   │    Extract ~4000 chars per page                 │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ D. CHUNKING & EMBEDDING                         │
   │    Split 7 pages → 50-60 chunks (1200 chars)   │
   │    Embed each chunk using sentence-transformers│
   │    Store in Pinecone temporary namespace        │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ E. RELEVANCE FILTERING ⭐ NEW!                   │
   │    Query embedding: "pembrolizumab"             │
   │    Compare to all 60 chunks                     │
   │    Keep only score > 0.68                       │
   │    Result: ~8-12 high-quality chunks            │
   │    Rejected: ~48-52 low-relevance chunks        │
   │    ⚠️  Logged: "Rejected 42 chunks (score<0.68)"│
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ F. EMPTY CHECK ⭐ NEW!                           │
   │    if filtered_chunks is empty:                 │
   │      return {                                   │
   │        "answer": "❌ Unable to find current info",
   │        "sources": []                            │
   │      }                                          │
   │    else:                                        │
   │      continue to LLM generation                 │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ G. LLM Generation (Groq)                        │
   │                                                 │
   │    System Prompt:                               │
   │    - NEVER use pre-training data                │
   │    - EVERY claim needs [Source N]              │
   │    - NEVER invent numbers                       │
   │    - Mark missing information [Not found]      │
   │                                                 │
   │    Input: Query + 8-12 chunks + history        │
   │    Output: Answer with citations                │
   └────────────────┬─────────────────────────────────┘
                    ↓
   ┌──────────────────────────────────────────────────┐
   │ H. Build Response                               │
   │    Return to Frontend:                          │
   │    {                                            │
   │      "answer": "Pembrolizumab is a monoclonal   │
   │                 antibody [Source 1] that....",  │
   │      "sources": [                               │
   │        {                                        │
   │          "title": "FDA approval letter",        │
   │          "url": "https://fda.gov/...",          │
   │          "relevance_score": 0.89                │
   │        },                                       │
   │        {                                        │
   │          "title": "NIH drug info",              │
   │          "url": "https://nih.gov/...",          │
   │          "relevance_score": 0.76                │
   │        }                                        │
   │      ]                                          │
   │    }                                            │
   └────────────────┬─────────────────────────────────┘
                    │ HTTP 200 OK
                    ↓
   
3. FRONTEND (Browser)
   ┌────────────────────────────────────────────────┐
   │ A. Receive Response                            │
   │    Sources: [2 items]                          │
   │    Answer: "Pembrolizumab..."                  │
   │                                                │
   │ B. Store in Message                           │
   │    msg = {                                     │
   │      role: "ai",                               │
   │      text: "Pembrolizumab...",                │
   │      sources: [S1, S2],                        │
   │      usedWebSearch: true                       │
   │    }                                           │
   │                                                │
   │ C. Pass to MessageBubble                      │
   │    msg.sources → msgBubble props              │
   │                                                │
   │ D. Render Sources Section                     │
   │    {msg.role === "ai" &&                       │
   │     msg.sources.length > 0 && (                │
   │      // Display sources section below          │
   │    )}                                          │
   └────────────────┬───────────────────────────────┘
                    ↓
   
4. DISPLAY TO USER
   ┌────────────────────────────────────────────────┐
   │ Answer:                                        │
   │                                                │
   │ "Pembrolizumab is a monoclonal antibody        │
   │  [Source 1] that blocks PD-1 [Source 1],       │
   │  approved by FDA [Source 1] for melanoma       │
   │  [Source 1] and lung cancer [Source 2]."       │
   │                                                │
   │ 📚 SOURCES (2)  ← Source section appears      │
   │ ┌───────────────┐  ┌───────────────┐          │
   │ │  [1] ↗️        │  │  [2] ↗️        │          │
   │ │ FDA approval  │  │ NIH drug info │          │
   │ │ 🌐 FDA.gov    │  │ 🌐 NIH.gov    │          │
   │ └───────────────┘  └───────────────┘          │
   │      ↓ Click           ↓ Click                  │
   │   Opens FDA         Opens NIH                  │
   │   website           website                    │
   └────────────────────────────────────────────────┘
```

---

## Component Architecture

```
MedAI App
├── Pages/
│   └── Chat.jsx ⭐ Orchestrator
│       ├─ Manages conversations
│       ├─ Stores messages with sources
│       ├─ Enables web search toggle
│       └─ Passes sources to ChatWindow
│
├── Components/
│   ├── Chat/
│   │   ├── ChatWindow.jsx
│   │   │   Maps messages → MessageBubble
│   │   │
│   │   ├── ChatInput.jsx
│   │   │   User input + send
│   │   │
│   │   └── MessageBubble.jsx ⭐ Source Display
│   │       ├─ Renders answer text
│   │       ├─ If AI message && has sources:
│   │       │   ├─ Source header
│   │       │   ├─ Source cards grid
│   │       │   ├─ Domain extraction
│   │       │   ├─ Hover animations
│   │       │   └─ Click handlers
│   │       └─ External links (new tab)
│   │
│   └── Other components...
│
├── Services/
│   └── api.jsx
│       analyzeChatMsg() returns:
│       ├─ answer: string
│       ├─ sources: [{title, url}][]
│       └─ usedWebSearch: boolean
│
├── CSS/
│   └── index.css ⭐ Animations
│       ├─ @keyframes sourceCardFadeIn
│       ├─ .source-card hover effects
│       ├─ Responsive grid layout
│       └─ Cascading delays
```

---

## Data Structure

### Message Object with Sources

```javascript
// What the frontend stores
{
  role: "ai",
  text: "Pembrolizumab is a monoclonal antibody [Source 1]...",
  
  // ⭐ NEW: Sources array
  sources: [
    {
      title: "FDA Approval Letter for Pembrolizumab (Keytruda)",
      url: "https://www.accessdata.fda.gov/...",
      relevance_score: 0.89  // From backend
    },
    {
      title: "Pembrolizumab Drug Profile - NIH",
      url: "https://pubchem.ncbi.nlm.nih.gov/...",
      relevance_score: 0.76
    },
    {
      title: "Keystroke Inhibitors in Oncology",
      url: "https://www.biomedcentral.com/...",
      relevance_score: 0.72
    }
  ],
  
  usedWebSearch: true  // Flag that web search was used
}
```

---

## Source Display HTML Structure

```html
<!-- Only shown if: msg.role === "ai" && msg.sources.length > 0 -->

<div style="marginTop: 12px; paddingLeft: 2px; animation: fadeIn 0.4s">
  
  <!-- Header with Source Counter -->
  <div style="...source header styles...">
    <svg><!-- Globe icon --></svg>
    <span>📚 SOURCES (3)</span>
  </div>
  
  <!-- Responsive Grid -->
  <div style="display: grid; gridTemplateColumns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px">
    
    <!-- Source Card 1 -->
    <a href="https://fda.gov/..." target="_blank" rel="noopener noreferrer" title="FDA approval letter...">
      <div>[1]</div>          <!-- Source index badge -->
      <svg>↗️</svg>            <!-- External link icon -->
      <div>FDA approval...</div>  <!-- Title -->
      <div>🌐 FDA.gov</div>   <!-- Domain -->
    </a>
    
    <!-- Source Card 2 -->
    <a href="https://nih.gov/..." target="_blank" rel="noopener noreferrer" title="NIH drug info...">
      <div>[2]</div>
      <svg>↗️</svg>
      <div>NIH drug profile</div>
      <div>🌐 NIH.gov</div>
    </a>
    
    <!-- Source Card 3 -->
    <a href="https://pubmed..." target="_blank" rel="noopener noreferrer" title="Medical journal...">
      <div>[3]</div>
      <svg>↗️</svg>
      <div>Clinical review article</div>
      <div>🌐 PubMed</div>
    </a>
    
  </div>
  
  <!-- Helper Text -->
  <div style="marginTop: 6px; fontSize: 9px; color: #64748b">
    <svg><!-- Clock icon --></svg>
    Click any source to visit website for detailed reference
  </div>
  
</div>
```

---

## State Flow Diagram

```
User Input
    │
    ├─ WITH Web Search Enabled
    │   ├─ Backend: Web Search Pipeline
    │   │   ├─ Query Rewriting
    │   │   ├─ Multi-Query Search
    │   │   ├─ Fetch Pages
    │   │   ├─ Chunking & Embedding
    │   │   ├─ RELEVANCE FILTER (0.68) ⭐
    │   │   │   ├─ Pass (score > 0.68) → Continue
    │   │   │   └─ Fail (score ≤ 0.68) → Reject (Log)
    │   │   ├─ EMPTY CHECK ⭐
    │   │   │   ├─ Empty → Return "Can't Find"
    │   │   │   └─ Has chunks → Generate Response
    │   │   ├─ LLM Generation
    │   │   └─ Return: answer + sources
    │   │
    │   ├─ Frontend: Receive & Store
    │   │   ├─ Extract sources from response
    │   │   ├─ Store in message.sources
    │   │   └─ Persist to localStorage
    │   │
    │   └─ Frontend: Display
    │       ├─ MessageBubble receives msg
    │       ├─ Render answer text
    │       ├─ Render source header & cards
    │       ├─ Apply animations
    │       └─ Make cards clickable
    │
    └─ WITHOUT Web Search
        ├─ Backend: Use RAG or LLM only
        ├─ Return: answer (no sources)
        └─ Frontend: Display answer only
```

---

## Timeline: Request to Display

```
T+0ms     User presses Send
T+100ms   Message appears in chat (optimistic)
T+300ms   Spinner starts
          API request sent to backend
          
T+800ms   DuckDuckGo search ~1s
T+1200ms  Fetching pages...
T+2200ms  Embedding chunks...
          
T+2800ms  ⭐ Relevance filtering (instant)
T+2900ms  ⭐ Empty check (instant)
T+2920ms  LLM generation starts
          
T+4200ms  LLM completes
          Response ready with sources
          
T+4300ms  Frontend receives response
          Sources extracted
          Message stored
          
T+4350ms  MessageBubble re-renders
          Answer text displays
          Source cards render in grid
          
T+4400ms  CSS animations start
          Cards cascade in (0.4s)
          
T+4800ms  All visible, fully interactive
          Cards hoverable
          Links clickable

TOTAL: 4.3 - 4.8 seconds
```

---

## Security Flow

```
External URL (from web search)
    ↓
Backend Validation
├─ Check URL format valid ✓
├─ Remove suspicious protocols ✓
└─ Pass to frontend
    ↓
Frontend HTML Generation
├─ href="https://..." ✓
├─ target="_blank" ✓
├─ rel="noopener noreferrer" ✓ ← Prevents referrer hijacking
└─ No onclick handlers ✓ (pure anchor link)
    ↓
User Clicks Card
    ↓
Browser Opens New Tab
├─ Domain: fda.gov/nih.gov/pubmed (verified safe)
├─ No referrer info leaked ✓
├─ Parent page cannot access new tab ✓
└─ New tab fully isolated ✓
```

---

## Responsive Layout Breakpoints

```
Desktop (>1024px)
┌─────────┬─────────┬─────────┬─────────┐
│ Source  │ Source  │ Source  │ Source  │
│   1     │   2     │   3     │   4+    │
└─────────┴─────────┴─────────┴─────────┘
Grid: auto-fill, minmax(140px, 1fr)

Tablet (768px to 1023px)
┌──────────┬──────────┬──────────┐
│ Source 1 │ Source 2 │ Source 3 │
└──────────┴──────────┴──────────┘
Grid: auto-fill, minmax(140px, 1fr)

Mobile (< 768px)
┌──────────────┐
│  Source 1    │
└──────────────┘
┌──────────────┐
│  Source 2    │
└──────────────┘
Grid: 1-2 columns
```

---

## Summary

```
PROBLEM                  SOLUTION              COMPONENT
─────────────────────────────────────────────────────────
Hallucination            Threshold (0.68)     web_rag_service.py
No "can't find" response Empty check           rag_service.py
No source transparency   Display cards        MessageBubble.jsx
Hard to verify info      Clickable links       MessageBubble.jsx
Mobile unfriendly        Responsive grid      index.css
Weak animations          CSS animations       index.css
```

**Result: Trustworthy, verifiable medical information!** ✅
