import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from routes import chat, triage, diet, food, drug, consultation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medai")

app = FastAPI(
    title="MedAI RAG Backend",
    description="RAG-powered medical AI chatbot using Pinecone + Groq LLaMA",
    version="1.0.0"
)

# Allow frontend dev server and production origins with full CORS support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Catch-all OPTIONS handler to guarantee preflight responses carry CORS headers
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return JSONResponse(
        content="OK",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


# Pre-load embedding model on server startup (prevents 30s request timeouts on Render during first PDF upload)
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing MedAI Backend & pre-loading embedding model...")
    try:
        from services.embedding_service import get_embedding_model
        get_embedding_model()
        logger.info("Embedding model successfully loaded into memory.")
    except Exception as e:
        logger.warning("Startup embedding model pre-load notice: %s", e)


# Global exception handlers to guarantee CORS headers are present even on errors
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"Access-Control-Allow-Origin": "*"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Document processing failed: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"},
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

