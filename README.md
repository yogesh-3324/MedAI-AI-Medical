# 🩺 MedAI: AI-Powered Healthcare Assistant

MedAI is a comprehensive, full-stack artificial intelligence platform designed to assist healthcare professionals and patients with high-precision medical research, diagnostic analysis, and automated clinical reporting.

## 🚀 Features

### 1. 🤖 MedAI Web-RAG Research Assistant
A high-precision, hallucination-free medical research chatbot powered by Groq's ultra-fast LLaMA models.
- **Live Internet Web-RAG Pipeline**: Automatically searches the web (FDA, ASCO, NEJM, Lancet) for up-to-date medical affairs.
- **PDF & Abstract Extraction**: Dynamically downloads and extracts text from clinical trial PDFs and HTML pages using `PyPDF2` and `httpx`.
- **Ephemeral Pinecone Vector Search**: Chunks and embeds scraped web data on the fly using `sentence-transformers`, temporarily upserts it into a Pinecone Vector Database, and performs strict semantic retrieval.
- **Strict Numerical Grounding**: Enforces absolute factual accuracy by explicitly verifying numerical claims (OS, PFS, ORR) against retrieved web sources.

### 2. 🎙️ Consultation Report Generator
Automates the creation of professional clinical reports directly from doctor-patient conversations.
- Leverages the **Web Speech API** for live audio transcription.
- Processes the raw transcript using a specialized Groq LLM to generate structured, professional medical reports automatically.

### 3. 💊 Drug Interaction Checker
Ensures patient safety by cross-referencing pharmaceutical profiles.
- Features dynamic, scrollable autocomplete suggestions for fast drug entry.
- Alerts users to potential contraindications and severe interaction risks.

### 5. 🔐 Persistent User Sessions
- Complete authentication flow powered by **Clerk**.
- Persistent Chat History maintaining multi-turn context (up to 15 chats) per user.

---

## 🛠️ Technology Stack

**Frontend**
- **React.js** (Vite)
- **Clerk** (Authentication)
- **React Router** (Navigation)
- **Recharts** (Data Visualization)
- **React Markdown** (Rich text rendering)

**Backend**
- **Python / FastAPI** (High-performance API framework)
- **Groq API** (Ultra-fast LLM inference)
- **Pinecone** (Vector Database for RAG)
- **Sentence-Transformers** (Local dense embeddings)
- **DuckDuckGo Search (`ddgs`)** (Live web retrieval)
- **PyPDF2 & httpx** (Document parsing and fetching)

---

## ⚙️ Local Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js & npm
- API Keys: `GROQ_API_KEY`, `PINECONE_API_KEY`, and Clerk Frontend Keys.

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Start the FastAPI server
python main.py
```

### Frontend Setup
```bash
cd frontend-2
npm install

# Start the development server
npm run dev
```

---

## 🏗️ Architecture Highlight: Ephemeral Web-RAG
MedAI uses a completely custom RAG (Retrieval-Augmented Generation) pipeline for web searches. Instead of blindly passing raw HTML to the LLM—which causes token overflow and hallucinations—the backend:
1. Performs an intent-aware DuckDuckGo search.
2. Downloads HTML and PDF trial results.
3. Chunks the text and embeds it locally.
4. Uploads to a temporary Pinecone namespace.
5. Performs semantic search to grab only the 8 most hyper-relevant dense chunks.
6. Feeds the grounded data to the LLM for perfectly cited, numerically verified answers.
