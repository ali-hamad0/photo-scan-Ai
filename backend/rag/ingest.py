"""
rag/ingest.py — Entry point for the ingestion pipeline.

Usage:
    python -m rag.ingest
    python -m rag.ingest --reset
"""
import sys

from rag.services.ingest import ingest

if __name__ == "__main__":
    ingest(reset="--reset" in sys.argv)
