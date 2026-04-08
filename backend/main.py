from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from routes import chat, triage, diet, food, drug, consultation

app = FastAPI(
    title="MedAI RAG Backend",
    description="RAG-powered medical AI chatbot using Pinecone + Groq LLaMA",
    version="1.0.0"
)

# Allow frontend dev server (Vite default port 5173) and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register chat routes under /api/chat
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


# Register triage routes under /api/triage
app.include_router(triage.router, prefix="/api/triage", tags=["triage"])

# Register diet routes under /api/diet
app.include_router(diet.router, prefix="/api/diet", tags=["diet"])

# Register food routes under /api/food
app.include_router(food.router, prefix="/api/food", tags=["food"])

# Register drug routes under /api/drug
app.include_router(drug.router, prefix="/api/drug", tags=["drug"])

# Register consultation report routes under /api/consultation
app.include_router(consultation.router, prefix="/api/consultation", tags=["consultation"])


@app.get("/")
async def root():
    return {"message": "MedAI RAG Backend is running", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
