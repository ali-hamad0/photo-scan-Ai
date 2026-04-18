from typing import Optional

from langchain_groq import ChatGroq

from rag.config import GROQ_API_KEY, GROQ_MODEL, GROQ_TEMPERATURE

_llm: Optional[ChatGroq] = None


def get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set. Add it to your .env file.")
        _llm = ChatGroq(
            model=GROQ_MODEL,
            temperature=GROQ_TEMPERATURE,
            groq_api_key=GROQ_API_KEY,
        )
    return _llm
