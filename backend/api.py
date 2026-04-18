from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from config import ALLOWED_ORIGINS
from database import create_tables
from auth import router as auth_router
from analyze import router as analyze_router, load_models
from chat import router as chat_router
from limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    print("✅ Database tables created")
    load_models()
    print("✅ Models loading complete")
    yield


app = FastAPI(
    title="PathoScan AI",
    description="Medical AI Diagnostic System",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Rate limiter ────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)

app.include_router(auth_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/")
def home():
    return {"message": "PathoScan AI is running"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/test-ai")
def test_ai():
    """Test endpoint to verify the Groq API key and model are working."""
    from rag.config import GROQ_API_KEY, GROQ_MODEL

    if not GROQ_API_KEY:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "error": "GROQ_API_KEY is not set"},
        )

    try:
        from langchain_core.messages import HumanMessage
        from rag.services.llm import get_llm

        response = get_llm().invoke([HumanMessage(content="Reply with exactly: ok")])
        return {
            "ok": True,
            "model": GROQ_MODEL,
            "response": response.content.strip(),
        }
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={"ok": False, "model": GROQ_MODEL, "error": str(exc)},
        )
