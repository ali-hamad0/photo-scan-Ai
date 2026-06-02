import hashlib
import logging
import os
import sys

import pandas as pd
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag.config import DOCS_DIR, MAX_CHARS, MAX_CHUNKS, VECTOR_DIR
from rag.services.embeddings import LocalEmbeddings

logger = logging.getLogger(__name__)


# ── Utilities ─────────────────────────────────────────────────────────────────

def _md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8", errors="replace")).hexdigest()


def _row_to_prose(row: dict) -> str:
    parts = []
    for col, val in row.items():
        if pd.isna(val) or str(val).strip() in ("", "nan", "NaN"):
            continue
        label = col.replace("_", " ").strip().title()
        parts.append(f"{label}: {val}")
    return ". ".join(parts) + "." if parts else ""


def _split_text(text: str, chunk_size: int = 500) -> list[str]:
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]


def _make_docs(text: str, metadata: dict) -> list[Document]:
    if len(text) <= MAX_CHARS:
        return [Document(page_content=text, metadata=metadata)]
    return [Document(page_content=part, metadata=metadata) for part in _split_text(text, 500)]


# ── Loaders ───────────────────────────────────────────────────────────────────

def load_pdfs() -> list[Document]:
    docs = []
    for filename in sorted(os.listdir(DOCS_DIR)):
        if not filename.endswith(".pdf"):
            continue
        path = os.path.join(DOCS_DIR, filename)
        logger.info("Loading PDF: %s", filename)
        try:
            pages = PyPDFLoader(path).load()
            for page in pages:
                page.metadata.update({"source": filename, "doc_type": "pdf"})
            docs.extend(pages)
            logger.info("  Loaded %d pages from %s", len(pages), filename)
        except Exception as exc:
            logger.warning("  Skipped %s — %s", filename, exc)
    return docs


def load_csvs() -> list[Document]:
    docs = []
    for filename in sorted(os.listdir(DOCS_DIR)):
        if not filename.endswith(".csv"):
            continue
        path = os.path.join(DOCS_DIR, filename)
        logger.info("Loading CSV: %s", filename)
        try:
            df = pd.read_csv(path, encoding="utf-8", on_bad_lines="skip", nrows=3000)
            df.columns = [c.lower().strip() for c in df.columns]
            file_docs = _parse_csv(df, filename)
            docs.extend(file_docs)
            logger.info("  Produced %d documents from %s", len(file_docs), filename)
        except Exception as exc:
            logger.warning("  Skipped %s — %s", filename, exc)
    return docs


def _parse_csv(df: pd.DataFrame, filename: str) -> list[Document]:
    cols = set(df.columns)
    base = {"source": filename, "doc_type": "csv"}

    if "question" in cols and "answer" in cols:
        docs = []
        for _, row in df.iterrows():
            q = str(row.get("question", "")).strip()
            a = str(row.get("answer",   "")).strip()
            if q and a and len(a) > 20:
                docs.extend(_make_docs(f"Q: {q}\nA: {a}", {**base, "type": "qa_pair"}))
        return docs

    lab_cols = {"wbc", "rbc", "hemoglobin", "hematocrit", "diagnosis",
                "label", "mcv", "platelets", "neutrophils", "lymphocytes"}
    if cols & lab_cols:
        docs = []
        for _, row in df.iterrows():
            prose     = _row_to_prose(row.to_dict())
            diagnosis = str(row.get("diagnosis", row.get("label", ""))).strip()
            if len(prose) > 30:
                content = f"Diagnosis: {diagnosis}. Lab result: {prose}" if diagnosis else f"Lab result: {prose}"
                docs.extend(_make_docs(content, {**base, "type": "lab_result", "diagnosis": diagnosis}))
        return docs

    docs = []
    for _, row in df.iterrows():
        prose = _row_to_prose(row.to_dict())
        if len(prose) > 30:
            docs.extend(_make_docs(prose, {**base, "type": "tabular"}))
    return docs


# ── Processing ────────────────────────────────────────────────────────────────

def deduplicate(docs: list[Document]) -> list[Document]:
    seen, unique = set(), []
    for doc in docs:
        h = _md5(doc.page_content)
        if h not in seen:
            seen.add(h)
            unique.append(doc)
    removed = len(docs) - len(unique)
    if removed:
        logger.info("Removed %d duplicate chunks", removed)
    return unique


def split_documents(docs: list[Document]) -> list[Document]:
    pdf_docs = [d for d in docs if d.metadata.get("doc_type") == "pdf"]
    csv_docs = [d for d in docs if d.metadata.get("doc_type") == "csv"]
    chunks   = []

    if pdf_docs:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=400,
            chunk_overlap=50,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        pdf_chunks = splitter.split_documents(pdf_docs)
        for c in pdf_chunks:
            c.page_content = c.page_content[:MAX_CHARS]
        chunks.extend(pdf_chunks)
        logger.info("PDF: %d chunks", len(pdf_chunks))

    if csv_docs:
        chunks.extend(csv_docs)
        logger.info("CSV: %d chunks", len(csv_docs))

    return chunks


# ── Main pipeline ─────────────────────────────────────────────────────────────

def ingest(reset: bool = False) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    logger.info("PathoScan AI — Ingestion Pipeline")

    if reset and os.path.exists(VECTOR_DIR):
        import shutil
        shutil.rmtree(VECTOR_DIR)
        os.makedirs(VECTOR_DIR)
        logger.info("Vector store cleared")

    logger.info("Loading documents from %s", DOCS_DIR)
    all_docs = load_pdfs() + load_csvs()
    logger.info("Raw total: %d documents", len(all_docs))

    if not all_docs:
        logger.warning("No documents found — aborting ingestion")
        return

    all_docs = deduplicate(all_docs)

    logger.info("Splitting documents...")
    chunks = split_documents(all_docs)

    for c in chunks:
        c.metadata["content_hash"] = _md5(c.page_content)

    if len(chunks) > MAX_CHUNKS:
        logger.warning("Capping at %d chunks (was %d)", MAX_CHUNKS, len(chunks))
        chunks = chunks[:MAX_CHUNKS]

    logger.info("Total chunks to embed: %d", len(chunks))
    logger.info("Generating embeddings (local model)...")

    safe_chunks = [
        Document(page_content=c.page_content[:MAX_CHARS], metadata=c.metadata)
        for c in chunks
    ]

    Chroma.from_documents(
        documents=safe_chunks,
        embedding=LocalEmbeddings(),
        persist_directory=VECTOR_DIR,
    )

    logger.info("Vector DB ready — %d chunks at %s", len(safe_chunks), VECTOR_DIR)


if __name__ == "__main__":
    ingest(reset="--reset" in sys.argv)
