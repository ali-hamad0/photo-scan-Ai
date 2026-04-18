from rag.services.vectorstore import get_vectorstore

_retriever = None


def get_retriever():
    global _retriever
    if _retriever is None:
        print("Initialising RAG retrieval stack...")
        _retriever = get_vectorstore().as_retriever(
            search_type="mmr",
            search_kwargs={"k": 10, "fetch_k": 25},
        )
        print("Retrieval stack ready (MMR)")
    return _retriever


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
