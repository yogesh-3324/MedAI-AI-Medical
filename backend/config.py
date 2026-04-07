import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Groq
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # Pinecone
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "medai-rag")
    PINECONE_CLOUD: str = os.getenv("PINECONE_CLOUD", "aws")
    PINECONE_REGION: str = os.getenv("PINECONE_REGION", "us-east-1")

    # Embedding
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "384"))

    # Chunking
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "500"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "50"))
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "5"))

    # Groq model
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    def validate(self):
        missing = []
        if not self.GROQ_API_KEY:
            missing.append("GROQ_API_KEY")
        if not self.PINECONE_API_KEY:
            missing.append("PINECONE_API_KEY")
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}. "
                "Please copy .env.example to .env and fill in your keys."
            )


settings = Settings()
