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


def chunk_rows(settings, item_id, product, doc, extra_metadata=None):
    """문서 하나를 청크 행으로 만든다. ID는 항목:문서:본문해시:순번이라 항목끼리 덮어쓰지 않는다."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
    rows = []
    for index, text in enumerate(splitter.split_text(doc["text"])):
        metadata = {"item_id": item_id, "doc_id": doc["doc_id"], "title": doc["title"],
                    "source_url": doc["source_url"], "source_type": "external_document",
                    "product": product, "content_hash": doc["content_hash"],
                    "chunk_hash": digest(text), "chunk_index": index,
                    "license": doc["license"], "publisher": doc["publisher"],
                    "product_version": doc["product_version"], "fetched_at": doc["fetched_at"]}
        rows.append({"id": f"{item_id}:{doc['doc_id']}:{doc['content_hash']}:{index}", "text": text,
                     "metadata": {**metadata, **(extra_metadata or {})}})
    return rows


def build_records(settings, documents):
    records = {"knowledge_items": [], "reference_chunks": []}
    for item in ITEMS:
        records["knowledge_items"].append({"id": item.item_id, "text": item_text(item), "metadata": {
            "item_id": item.item_id, "doc_id": item.primary_doc_id, "title": item.title_ko,
            "source_url": item.source_url, "source_type": "item_metadata", "product": item.product,
            "license": DOCUMENTS[item.primary_doc_id]["license"], "publisher": DOCUMENTS[item.primary_doc_id]["publisher"],
        }})
        for doc_id in item.document_ids:
            records["reference_chunks"] += chunk_rows(settings, item.item_id, item.product, documents[doc_id])
    return records


def cached_vectors(settings, texts, embedder, dimensions):
    """본문 해시별 벡터 캐시. 없는 텍스트만 임베딩하고 (벡터들, API 호출 수, 차원)을 돌려준다."""
    vector_dir = settings.chroma_path.parent / "corpus" / "vectors" / digest(json.dumps(identity(settings), sort_keys=True))
    missing = {digest(text): text for text in texts if not (vector_dir / (digest(text) + ".json")).exists()}
    calls = 0
    if missing:
        vectors = embedder(settings, list(missing.values()))
        calls = 1
        for key, vector in zip(missing, vectors, strict=True):
            if dimensions not in (None, len(vector)):
                raise ValueError("embedding_dimension_changed")
            dimensions = len(vector)
            save_json(vector_dir / (key + ".json"), vector)
    vectors = [json.loads((vector_dir / (digest(text) + ".json")).read_text()) for text in texts]
    dimensions = dimensions or len(vectors[0])
    if any(len(v) != dimensions for v in vectors):
        raise ValueError("embedding_dimension_changed")
    return vectors, calls, dimensions


def has_ids(collection, ids):
    return len(collection.get(ids=ids, include=[])["ids"]) == len(ids)


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
        # 질문 중 수집한 청크가 더 있을 수 있으므로 건수가 아니라 기본 청크 ID가 모두 있는지 본다.
        if old and old.get("complete") and all(has_ids(collections[k], [r["id"] for r in v]) for k, v in records.items()):
            return {**old, "http_requests": collector.requests, "embedding_batches": 0, "cache_hit": True}
        if not old and any(c.count() for c in collections.values()):
            raise ValueError("unmanaged_index_use_new_chroma_path")
        manifest = {"identity": identity(settings), "corpus_hash": corpus_hash, "complete": False,
                    "dimensions": old.get("dimensions") if old else None}
        save_json(settings.chroma_path / "manifest.json", manifest)
        for name, rows in records.items():
            for start in range(0, len(rows), 32):
                batch = rows[start:start + 32]
                vectors, batch_calls, manifest["dimensions"] = cached_vectors(
                    settings, [r["text"] for r in batch], embedder, manifest["dimensions"])
                calls += batch_calls
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
