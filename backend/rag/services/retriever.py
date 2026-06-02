import logging
from functools import lru_cache

from rag.services.vectorstore import get_vectorstore

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_retriever():
    logger.info("Initialising RAG retrieval stack...")
    retriever = get_vectorstore().as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": 6,
            "fetch_k": 20,
            "lambda_mult": 0.7,
        },
    )
    logger.info("Retrieval stack ready (MMR, k=6)")
    return retriever


def retrieve(query: str) -> list:
    return get_retriever().invoke(query)


def format_docs(docs: list) -> str:
    parts = []
    for i, doc in enumerate(docs, 1):
        src    = doc.metadata.get("source", "")
        header = f"[Source {i}: {src}]" if src else f"[Source {i}]"
        parts.append(f"{header}\n{doc.page_content}")
    return "\n\n".join(parts)


def extract_sources(docs: list) -> list[str]:
    seen, result = set(), []
    for doc in docs:
        src   = doc.metadata.get("source", "Unknown source")
        page  = doc.metadata.get("page", "")
        dtype = doc.metadata.get("doc_type", "")
        label = src
        if page != "":
            label += f"  (page {int(page) + 1})"
        if dtype:
            label += f"  [{dtype.upper()}]"
        if label not in seen:
            seen.add(label)
            result.append(label)
    return result
