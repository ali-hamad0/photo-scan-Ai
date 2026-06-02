from functools import lru_cache

from langchain_chroma import Chroma

from rag.config import VECTOR_DIR
from rag.services.embeddings import LocalEmbeddings


@lru_cache(maxsize=1)
def get_vectorstore() -> Chroma:
    return Chroma(
        persist_directory=VECTOR_DIR,
        embedding_function=LocalEmbeddings(),
    )
