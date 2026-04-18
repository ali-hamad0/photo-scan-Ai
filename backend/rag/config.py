import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL:   str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TEMPERATURE: float = float(os.getenv("GROQ_TEMPERATURE", "0.2"))

_HERE      = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR   = os.path.join(_HERE, "documents")
VECTOR_DIR = os.path.join(_HERE, "vectorstore")

MAX_HISTORY_TURNS = 10
MAX_CHARS         = 1000
MAX_CHUNKS        = 3000
