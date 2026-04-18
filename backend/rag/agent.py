"""
rag/agent.py — Public API for the RAG pipeline.

Thin wrapper so chat.py can import ask(), ask_stream(), seed_history(),
and clear_session() without knowing the internal structure.
"""

from rag.config import MAX_HISTORY_TURNS  # re-exported for chat.py
from rag.services.chain import ask, ask_stream
from rag.services.memory import clear, seed


def seed_history(session_id: str, messages: list[dict]) -> None:
    seed(session_id, messages)


def clear_session(session_id: str) -> None:
    clear(session_id)


# backward-compat aliases used by analyze.py
def get_qa_chain():
    return lambda q: ask(q).get("answer", "")


def get_chain():
    return get_qa_chain()
