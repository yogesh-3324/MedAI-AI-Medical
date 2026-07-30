FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install system dependencies including Tesseract OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy dependency definition
COPY requirements.txt .

# Install dependencies (using CPU PyTorch wheels if needed or default PyTorch)
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source files
COPY . .

# Expose backend port
EXPOSE 8000

# Start FastAPI server using uvicorn binding to 0.0.0.0 and dynamic PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
