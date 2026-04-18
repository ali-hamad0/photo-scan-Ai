from langchain_core.embeddings import Embeddings


class LocalEmbeddings(Embeddings):
    """Chroma's built-in onnxruntime model (all-MiniLM-L6-v2). No API key needed."""

    def __init__(self):
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        self._ef = DefaultEmbeddingFunction()

    def embed_documents(self, texts: list) -> list:
        return [[float(v) for v in row] for row in self._ef(texts)]

    def embed_query(self, text: str) -> list:
        return [float(v) for v in self._ef([text])[0]]
