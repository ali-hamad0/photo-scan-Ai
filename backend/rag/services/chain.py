import asyncio
import logging
from typing import AsyncGenerator

from langchain_core.output_parsers import StrOutputParser

from rag.prompts import CONDENSE_PROMPT, get_answer_prompt
from rag.services.llm import get_llm
from rag.services.memory import format_history, get_history, update_history
from rag.services.retriever import extract_sources, format_docs, retrieve

logger = logging.getLogger(__name__)

_FALLBACK = (
    "I couldn't find specific information about that in my medical "
    "knowledge base.\n\n**Recommended Next Step**\nPlease consult a "
    "qualified healthcare professional for accurate guidance."
)

# Pronouns/references that make a follow-up ambiguous without prior context
_CONTEXT_REFS = frozenset({
    "it", "that", "this", "they", "those", "these", "them",
    "he", "she", "its", "their", "his", "her",
})


def _needs_condensing(question: str) -> bool:
    """Return True only when the question contains a pronoun/reference that
    requires prior context to resolve into a standalone question."""
    words = set(question.lower().split())
    return bool(_CONTEXT_REFS & words)


def _condense(question: str, session_id: str) -> str:
    """Rewrite as standalone only when prior history exists and needed."""
    if not get_history(session_id) or not _needs_condensing(question):
        return question
    chain = CONDENSE_PROMPT | get_llm() | StrOutputParser()
    return chain.invoke({
        "chat_history": format_history(session_id),
        "question":     question,
    })


def _scan_block(scan_context: str) -> str:
    if not scan_context:
        return ""
    return f"Patient's Scan Results (refer to these when relevant):\n{scan_context}\n\n"


def ask(question: str, session_id: str = "default", scan_context: str = "") -> dict:
    try:
        standalone    = _condense(question, session_id)
        docs          = retrieve(standalone)
        answer_prompt = get_answer_prompt(standalone)

        if not docs:
            update_history(session_id, question, _FALLBACK)
            return {"answer": _FALLBACK, "sources": [], "session_id": session_id}

        chain  = answer_prompt | get_llm() | StrOutputParser()
        answer = chain.invoke({
            "context":      format_docs(docs),
            "question":     standalone,
            "scan_context": _scan_block(scan_context),
        })
        sources = extract_sources(docs)
        update_history(session_id, question, answer)
        return {"answer": answer, "sources": sources, "session_id": session_id}

    except Exception as exc:
        logger.error("ask() failed: %s", exc)
        return {
            "answer":     f"Sorry, I encountered an error: {exc}. Please try again.",
            "sources":    [],
            "session_id": session_id,
        }


async def ask_stream(
    question:     str,
    session_id:   str = "default",
    scan_context: str = "",
) -> AsyncGenerator[dict, None]:
    try:
        standalone    = await asyncio.to_thread(_condense, question, session_id)
        docs          = await asyncio.to_thread(retrieve, standalone)
        answer_prompt = get_answer_prompt(standalone)

        if not docs:
            yield {"type": "token",   "content": _FALLBACK}
            yield {"type": "sources", "content": []}
            update_history(session_id, question, _FALLBACK)
            return

        sources     = extract_sources(docs)
        full_answer = ""

        stream_chain = answer_prompt | get_llm() | StrOutputParser()
        async for token in stream_chain.astream({
            "context":      format_docs(docs),
            "question":     standalone,
            "scan_context": _scan_block(scan_context),
        }):
            full_answer += token
            yield {"type": "token", "content": token}

        yield {"type": "sources", "content": sources}
        update_history(session_id, question, full_answer)

    except Exception as exc:
        logger.error("ask_stream() failed: %s", exc)
        yield {"type": "error", "content": str(exc)}
