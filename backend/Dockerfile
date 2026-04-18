# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# System dependencies for TensorFlow and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first to avoid hash-verification bugs in pip <25
RUN pip install --upgrade pip

# --- Heavy dependencies (TensorFlow, LangChain, etc.) ---
# This layer is cached separately. It only re-runs if requirements-heavy.txt changes.
COPY requirements-heavy.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=600 --retries 5 -r requirements-heavy.txt

# --- App dependencies (change more often) ---
# Only this layer re-runs when you add a new package here.
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=600 --retries 5 -r requirements.txt

# Copy all backend source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
