# MedAI — RAG Backend

Full RAG pipeline powering the **"Chat with MedAI"** feature.

```
Stack:  FastAPI · Groq LLaMA3-8b · Pinecone (serverless) · sentence-transformers · LangChain text splitter
```

---

## Architecture

```
User uploads PDF / Image
        │
        ▼
┌──────────────────┐
│  Document Parser  │  (PyPDF2 for PDFs, pytesseract for images)
└────────┬─────────┘
         │  raw text
         ▼
┌──────────────────┐
│  Text Splitter    │  RecursiveCharacterTextSplitter (chunk_size=500, overlap=50)
└────────┬─────────┘
         │  chunks[]
         ▼
┌──────────────────┐
│  Embedding Model  │  sentence-transformers/all-MiniLM-L6-v2  (dim=384)
└────────┬─────────┘
         │  vectors[]
         ▼
┌──────────────────┐
│    Pinecone       │  Serverless index — namespaced per upload session
└──────────────────┘

User sends query
        │
        ▼
 Embed query → Pinecone similarity search → top-K chunks
        │
        ▼
 Groq LLaMA3-8b  (RAG prompt = system + context chunks + user query)
        │
        ▼
 Answer streamed back to frontend
```

---

## Quick Start

### 1. Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Tesseract OCR | 5.x (for image uploads) |

Install Tesseract:
```bash
# Ubuntu / Debian
sudo apt install tesseract-ocr

# macOS
brew install tesseract

# Windows — download installer from https://github.com/UB-Mannheim/tesseract/wiki
```

### 2. Clone / copy the backend folder

Your project structure should look like:

```
project/
├── backend/          ← this folder
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── .env          ← create from .env.example
│   ├── routes/
│   ├── services/
│   └── utils/
└── frontend-2/       ← your existing Vite React app
    ├── src/
    │   ├── services/api.jsx     ← replace with frontend_patch/api.jsx
    │   └── pages/Chat.jsx      ← replace with frontend_patch/Chat.jsx
    └── .env                    ← create from frontend_patch/.env
```

### 3. Set up the backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in GROQ_API_KEY and PINECONE_API_KEY
```

Get your keys:
- **Groq API key** → https://console.groq.com/keys  (free tier available)
- **Pinecone API key** → https://app.pinecone.io  (free serverless tier available)

### 4. Patch the frontend

```bash
# From the project root:
cp backend/frontend_patch/api.jsx  frontend-2/src/services/api.jsx
cp backend/frontend_patch/Chat.jsx frontend-2/src/pages/Chat.jsx
cp backend/frontend_patch/.env     frontend-2/.env
```

### 5. Run both servers

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python main.py
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

**Terminal 2 — Frontend:**
```bash
cd frontend-2
npm install     # only needed once
npm run dev
# → http://localhost:5173
```

---

## API Reference

### `POST /api/chat/upload`

Upload a document for RAG ingestion.

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | PDF, PNG, JPG, TXT |

**Response:**
```json
{
  "session_id": "uuid-string",
  "filename":   "report.pdf",
  "file_type":  "pdf",
  "num_chunks": 42,
  "message":    "✅ Document 'report.pdf' processed successfully..."
}
```

---

### `POST /api/chat/message`

Send a query; receive a RAG-powered answer.

**Request:** `application/json`
```json
{
  "message":    "What does the report say about my cholesterol?",
  "session_id": "uuid-string"   // omit for general medical Q&A
}
```

**Response:**
```json
{
  "answer":   "Based on your report, your LDL cholesterol...",
  "used_rag": true
}
```

---

## Configuration

All tuneable parameters live in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | **Required** |
| `PINECONE_API_KEY` | — | **Required** |
| `PINECONE_INDEX_NAME` | `medai-rag` | Pinecone index name |
| `PINECONE_CLOUD` | `aws` | `aws` or `gcp` |
| `PINECONE_REGION` | `us-east-1` | Pinecone region |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model |
| `EMBEDDING_DIMENSION` | `384` | Must match model output dim |
| `CHUNK_SIZE` | `500` | Characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between chunks |
| `TOP_K_RESULTS` | `5` | Chunks retrieved per query |

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Missing required environment variables` | Fill in `GROQ_API_KEY` and `PINECONE_API_KEY` in `.env` |
| `PDF appears to be scanned` | Enable OCR path — ensure `pytesseract` + Tesseract-OCR are installed |
| `No module named 'groq'` | `pip install -r requirements.txt` inside your venv |
| CORS error in browser | Check `VITE_API_URL` in `frontend-2/.env` matches backend port |
| Pinecone `dimension mismatch` | Delete existing index in Pinecone dashboard and restart backend |
