"""
backend/config.py - Centralized configuration loaded from environment variables.

Copy .env.example to .env and fill in your values before running the server.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── Security ───────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")

if SECRET_KEY == "change-me-in-production":
    raise RuntimeError(
        "SECRET_KEY is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\" "
        "and add it to your .env file."
    )
ALGORITHM: str = "HS256"
TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

# ── Database ───────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:1234@localhost:3306/pathoscan",
)

# ── CORS ───────────────────────────────────────────────────────
# Comma-separated list of allowed origins, e.g. "http://localhost:3000,https://yourapp.com"
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ── Gemini AI ──────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Rate limiting ──────────────────────────────────────────────
RATE_LIMIT_ANALYZE: str = os.getenv("RATE_LIMIT_ANALYZE", "10/minute")
RATE_LIMIT_LOGIN: str = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_REGISTER: str = os.getenv("RATE_LIMIT_REGISTER", "3/minute")
RATE_LIMIT_CHAT: str = os.getenv("RATE_LIMIT_CHAT", "20/minute")
