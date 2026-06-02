from functools import lru_cache

from langchain_groq import ChatGroq

from rag.config import GROQ_API_KEY, GROQ_MODEL, GROQ_TEMPERATURE


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")
    return ChatGroq(
        model=GROQ_MODEL,
        temperature=GROQ_TEMPERATURE,
        groq_api_key=GROQ_API_KEY,
        max_retries=3,
        request_timeout=30.0,
    )
