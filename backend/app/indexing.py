from pathlib import Path

import chromadb
from chromadb.config import Settings as ChromaSettings

COLLECTIONS = ("knowledge_items", "reference_chunks")


def open_store(path: Path):
    client = chromadb.PersistentClient(
        path=str(path), settings=ChromaSettings(anonymized_telemetry=False),
    )
    # Explicit vectors only: do not download Chroma's default embedding model.
    collections = {name: client.get_or_create_collection(name, embedding_function=None)
                   for name in COLLECTIONS}
    return client, collections
