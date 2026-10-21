import json
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.catalog import ITEMS, DOCUMENTS, item_text
from app.collectors import Collector, digest, save_json
from app.indexing import open_store
from app.providers import embed


def identity(settings):
    return {"provider_url": settings.embedding_base_url.rstrip("/"), "model": settings.embedding_model,
            "normalization": "none", "chunk_size": settings.chunk_size, "chunk_overlap": settings.chunk_overlap}


def load_manifest(settings):
    path = settings.chroma_path / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def check_manifest(settings):
    manifest = load_manifest(settings)
    if not manifest or not manifest.get("complete"):
        raise ValueError("index_not_ready")
    if manifest["identity"] != identity(settings):
        raise ValueError("index_configuration_changed")
    return manifest


def build_records(settings, documents):
    splitter = RecursiveCharacterTextSplitter(chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
    records = {"knowledge_items": [], "reference_chunks": []}
    for item in ITEMS:
        records["knowledge_items"].append({"id": item.item_id, "text": item_text(item), "metadata": {
            "item_id": item.item_id, "doc_id": item.primary_doc_id, "title": item.title_ko,
            "source_url": item.source_url, "source_type": "item_metadata", "product": item.product,
            "license": DOCUMENTS[item.primary_doc_id]["license"], "publisher": DOCUMENTS[item.primary_doc_id]["publisher"],
        }})
        for doc_id in item.document_ids:
            doc = documents[doc_id]
            for index, text in enumerate(splitter.split_text(doc["text"])):
                records["reference_chunks"].append({
                    "id": f"{item.item_id}:{doc_id}:{doc['content_hash']}:{index}", "text": text,
                    "metadata": {"item_id": item.item_id, "doc_id": doc_id, "title": doc["title"],
                                 "source_url": doc["source_url"], "source_type": "external_document",
                                 "product": item.product, "content_hash": doc["content_hash"],
                                 "chunk_hash": digest(text), "chunk_index": index,
                                 "license": doc["license"], "publisher": doc["publisher"],
                                 "product_version": doc["product_version"], "fetched_at": doc["fetched_at"]},
                })
    return records


def prepare(settings, embedder=embed):
    root = settings.chroma_path.parent / "corpus"
    collector = Collector(root)
    old = load_manifest(settings)
    if old and old["identity"] != identity(settings):
        raise ValueError("index_configuration_changed_use_new_chroma_path")
    for url in sorted({d["usage_terms_url"] for d in DOCUMENTS.values()}):
        collector.fetch(url)
    documents = {key: collector.document(key) for key in DOCUMENTS}
    records = build_records(settings, documents)
    corpus_hash = digest(json.dumps(records, sort_keys=True, ensure_ascii=False))
    if old and old["corpus_hash"] != corpus_hash:
        raise ValueError("corpus_changed_use_new_chroma_path")
    store, collections = open_store(settings.chroma_path)
    calls = 0
    try:
        if old and old.get("complete") and all(collections[k].count() == len(v) for k, v in records.items()):
            return {**old, "http_requests": collector.requests, "embedding_batches": 0, "cache_hit": True}
        if not old and any(c.count() for c in collections.values()):
            raise ValueError("unmanaged_index_use_new_chroma_path")
        manifest = {"identity": identity(settings), "corpus_hash": corpus_hash, "complete": False,
                    "dimensions": old.get("dimensions") if old else None}
        save_json(settings.chroma_path / "manifest.json", manifest)
        vector_dir = root / "vectors" / digest(json.dumps(identity(settings), sort_keys=True))
        for name, rows in records.items():
            for start in range(0, len(rows), 32):
                batch = rows[start:start + 32]
                missing = {digest(row["text"]): row["text"] for row in batch
                           if not (vector_dir / (digest(row["text"]) + ".json")).exists()}
                if missing:
                    vectors = embedder(settings, list(missing.values()))
                    calls += 1
                    for key, vector in zip(missing, vectors, strict=True):
                        if manifest["dimensions"] not in (None, len(vector)):
                            raise ValueError("embedding_dimension_changed")
                        manifest["dimensions"] = len(vector)
                        save_json(vector_dir / (key + ".json"), vector)
                vectors = [json.loads((vector_dir / (digest(r["text"]) + ".json")).read_text()) for r in batch]
                if not manifest["dimensions"]:
                    manifest["dimensions"] = len(vectors[0])
                if any(len(v) != manifest["dimensions"] for v in vectors):
                    raise ValueError("embedding_dimension_changed")
                collections[name].upsert(ids=[r["id"] for r in batch], documents=[r["text"] for r in batch],
                                         metadatas=[r["metadata"] for r in batch], embeddings=vectors)
        save_json(root / "documents.json", documents)
        save_json(root / "items.json", [item.model_dump() for item in ITEMS])
        manifest.update(complete=True, counts={k: c.count() for k, c in collections.items()},
                        source_documents=len(documents), http_requests=collector.requests, embedding_batches=calls)
        save_json(settings.chroma_path / "manifest.json", manifest)
        return manifest
    finally:
        store.close()
