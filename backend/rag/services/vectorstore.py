from typing import Optional

from langchain_chroma import Chroma

from rag.config import VECTOR_DIR
from rag.services.embeddings import LocalEmbeddings

_vectorstore: Optional[Chroma] = None


def get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=VECTOR_DIR,
            embedding_function=LocalEmbeddings(),
        )
    return _vectorstore
