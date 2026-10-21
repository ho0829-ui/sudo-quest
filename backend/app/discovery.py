"""외부 문서 후보 검색·선별·수집(F2004).

후보는 허용한 공식 페이지의 절 목록(catalog/section_catalog.json)에서만 나온다.
모델은 후보 ID 중에서만 고를 수 있고, 새 URL을 만들 수 없다.
"""
import json
import re
from pathlib import Path

from app.catalog import CATALOG_DIR, DOCUMENTS
from app.collectors import Collector, digest
from app.corpus import cached_vectors, chunk_rows
from app.providers import embed

STOPWORDS = {"the", "a", "an", "of", "to", "in", "on", "and", "or", "is", "for", "with", "error", "linux", "aws", "curl"}


def load_sections(path: Path = CATALOG_DIR / "section_catalog.json"):
    if not path.exists():
        return "none", {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["version"], data["sections"]


SECTION_VERSION, SECTIONS = load_sections()


def tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9_.-]+", text.lower()) if len(t) > 1 and t not in STOPWORDS}


def search_sections(queries, exclude, limit, sections=None):
    """검색어 토큰이 제목·절 이름·요약과 겹치는 정도로 후보를 고른다. 제목 일치는 2배."""
    sections = SECTIONS if sections is None else sections
    wanted = set().union(*(tokens(q) for q in queries)) if queries else set()
    scored = []
    for doc_id, entry in sections.items():
        if doc_id in exclude:
            continue
        title = tokens(entry["title"] + " " + entry["section"])
        score = 2 * len(wanted & title) + len(wanted & tokens(entry["summary"]))
        if score:
            scored.append((-score, doc_id))
    return [sections[doc_id] for _, doc_id in sorted(scored)[:limit]]


def candidate_view(entry):
    """프롬프트 2에는 본문이 아니라 제목·요약·제품만 보여준다."""
    return {key: entry[key] for key in ("doc_id", "title", "summary", "product")}


def find_candidates(item, queries, limit):
    linked = [SECTIONS.get(doc_id) or {**DOCUMENTS[doc_id], "summary": ""} for doc_id in item.document_ids]
    found = search_sections(queries, set(item.document_ids), limit)
    return linked + found


def query_cache_path(settings, item_id, queries):
    normalized = sorted({" ".join(q.lower().split()) for q in queries})
    key = digest(json.dumps({"item": item_id, "queries": normalized, "sections": SECTION_VERSION}, sort_keys=True))
    return settings.chroma_path.parent / "corpus" / "query_cache" / (key + ".json")


def finalize_selection(item, selection, candidates, max_selected):
    """선별 결과를 검증하고 항목 자체 문서를 맨 앞에 강제로 넣는다."""
    allowed = {c["doc_id"] for c in candidates}
    if not set(selection.selected_ids) <= allowed or not set(selection.reasons) <= allowed:
        raise ValueError("invalid_document_selection")
    others = [d for d in dict.fromkeys(selection.selected_ids) if d != item.primary_doc_id][:max_selected]
    reasons = dict(selection.reasons)
    if item.primary_doc_id not in selection.selected_ids:
        reasons[item.primary_doc_id] = "선택 항목 자체 설명 문서는 항상 포함"
    return [item.primary_doc_id] + others, reasons


def ensure_indexed(settings, collections, item, doc_ids, dimensions, embedder=embed):
    """선택된 문서 중 이 항목으로 아직 색인되지 않은 것만 수집·청킹·임베딩한다."""
    chunks = collections["reference_chunks"]
    collected, calls = [], 0
    collector = Collector(settings.chroma_path.parent / "corpus", {})
    for doc_id in doc_ids:
        found = chunks.get(where={"$and": [{"item_id": item.item_id}, {"doc_id": doc_id}]}, limit=1, include=[])
        if found["ids"]:
            continue
        definition = {k: v for k, v in (SECTIONS.get(doc_id) or DOCUMENTS[doc_id]).items()
                      if k not in ("summary", "source_name")}
        collector.allowed |= {definition["canonical_url"], definition["usage_terms_url"]}
        doc = collector.document(doc_id, {doc_id: definition})
        rows = chunk_rows(settings, item.item_id, item.product, doc, {"origin": "query_selected"})
        vectors, batch_calls, _ = cached_vectors(settings, [r["text"] for r in rows], embedder, dimensions)
        calls += batch_calls
        chunks.upsert(ids=[r["id"] for r in rows], documents=[r["text"] for r in rows],
                      metadatas=[r["metadata"] for r in rows], embeddings=vectors)
        collected.append(doc_id)
    return {"collected": collected, "embedding_calls": calls,
            "http_requests": collector.requests}
