"""청크 크기·Top-k 설정 비교(F2005/F2006 검증).

backend 폴더에서 실행: .venv/Scripts/python.exe -X utf8 -m scripts.compare_settings [--generate]
- 청크 700/1000/1400(중복 200 고정)으로 실험용 색인 data/chroma-exp-<크기>를 만든다(서비스 색인과 분리).
- F2015 질문으로 검색만 실행해 핵심 원문 문구가 근거에 들어오는지 본다(생성 호출 없음).
- Top-k 2/4/6은 청크 1000 색인에서 비교한다. --generate면 일부 질문은 실제 답변까지 만든다(유료).
설정 효과만 보기 위해 질문 중 문서 수집(F2004)은 쓰지 않고 항목에 연결된 기본 문서 안에서만 검색한다.
"""
import argparse
import json
import re
import statistics
import sys
import time
from pathlib import Path

from app.catalog import ITEM_BY_ID
from app.collectors import digest, save_json
from app.config import load_settings
from app.contracts import ChatRequest
from app.corpus import cached_vectors, prepare
from app.indexing import open_store
from app.providers import embed
from app.rag import respond

QUESTIONS = Path(__file__).resolve().parents[1] / "evaluation" / "f2015_questions.json"
SIZES = (700, 1000, 1400)
TOP_KS = (2, 4, 6)
GENERATE_IDS = ("Q2", "Q3", "Q4")
# 질문별로 근거에 들어와야 하는 원문 문구(정답 기준 절에서 그대로 뽑음).
MARKERS = {
    "Q1": ["fails open", "unused state"],
    "Q2": ["client closed the connection", "increase the client timeout"],
    "Q3": ["keep-alive does not prevent", "at least 1 byte"],
    "Q4": ["(10 seconds)", "ephemeral ports"],
    "Q5": ["only appears if --fail is used"],
    "Q6": ["DNS lookup", "maximum time in seconds that you allow each transfer"],
    "Q7": ["nr_open", "file-max"],
    "Q8": ["no room for the data", "quota of disk blocks"],
}


def experiment_settings(base, size):
    return base.model_copy(update={"chunk_size": size, "chunk_overlap": 200,
                                   "chroma_path": base.chroma_path.parent / f"chroma-exp-{size}"})


def chunk_stats(collection):
    rows = collection.get(include=["documents", "metadatas"])
    lengths = [len(text) for text in rows["documents"]]
    per_doc = {}
    for meta in rows["metadatas"]:
        key = (meta["item_id"], meta["doc_id"])
        per_doc[key] = per_doc.get(key, 0) + 1
    split = [n for n in per_doc.values() if n > 1]
    return {"chunks": len(lengths), "min": min(lengths), "median": statistics.median(lengths),
            "mean": round(statistics.mean(lengths)), "max": max(lengths),
            "documents_split_into_several": len(split), "max_chunks_per_document": max(per_doc.values())}


def retrieve(collections, item, vector, k):
    """서비스 retrieve와 같은 필터(항목·연결 문서)로 외부 청크 Top-k를 가져온다."""
    found = collections["reference_chunks"].query(
        query_embeddings=[vector], n_results=k, include=["documents", "metadatas"],
        where={"$and": [{"item_id": item.item_id}, {"doc_id": {"$in": item.document_ids}}]})
    seen, chunks = set(), []
    for text, meta in zip(found["documents"][0], found["metadatas"][0]):
        if (meta["source_url"], digest(text)) not in seen:
            seen.add((meta["source_url"], digest(text)))
            chunks.append({"doc_id": meta["doc_id"], "chunk_index": meta["chunk_index"], "chars": len(text), "text": text})
    return chunks


def marker_hits(qid, chunks):
    # 원문 추출 시 줄바꿈이 문장 중간에 남을 수 있어 공백을 하나로 맞춘 뒤 찾는다.
    joined = re.sub(r"\s+", " ", " ".join(c["text"] for c in chunks))
    return [m for m in MARKERS[qid] if m in joined]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", help="Top-k별 실제 답변 생성(유료)")
    args = parser.parse_args()
    base = load_settings()
    questions = [q for q in json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"] if q["id"] in MARKERS]
    # 질문 벡터는 설정과 무관하므로 한 번만 만든다(벡터 캐시 사용).
    vectors, query_calls, _ = cached_vectors(base, [q["question"] for q in questions], embed, None)
    report = {"index": {}, "chunk_retrieval": {}, "top_k_retrieval": {}, "generation": [],
              "query_embedding_calls": query_calls}

    for size in SIZES:
        settings = experiment_settings(base, size)
        manifest = prepare(settings)
        store, collections = open_store(settings.chroma_path)
        try:
            report["index"][size] = {**chunk_stats(collections["reference_chunks"]),
                                     "embedding_batches": manifest["embedding_batches"]}
            rows = {}
            for q, vector in zip(questions, vectors):
                chunks = retrieve(collections, ITEM_BY_ID[q["item_id"]], vector, base.external_top_k)
                rows[q["id"]] = {"hits": marker_hits(q["id"], chunks), "evidence_chars": sum(c["chars"] for c in chunks),
                                 "chunks": [f'{c["doc_id"]}#{c["chunk_index"]}' for c in chunks]}
            report["chunk_retrieval"][size] = rows
            if size == 1000:
                for k in TOP_KS:
                    report["top_k_retrieval"][k] = {}
                    for q, vector in zip(questions, vectors):
                        chunks = retrieve(collections, ITEM_BY_ID[q["item_id"]], vector, k)
                        report["top_k_retrieval"][k][q["id"]] = {
                            "hits": marker_hits(q["id"], chunks), "evidence_chars": sum(c["chars"] for c in chunks),
                            "chunks": [f'{c["doc_id"]}#{c["chunk_index"]}' for c in chunks]}
                if args.generate:
                    for k in TOP_KS:
                        k_settings = settings.model_copy(update={"external_top_k": k})
                        for q in questions:
                            if q["id"] not in GENERATE_IDS:
                                continue
                            start = time.monotonic()
                            result = respond(k_settings, collections, ChatRequest(item_id=q["item_id"], question=q["question"]))
                            report["generation"].append({
                                "k": k, "id": q["id"], "seconds": round(time.monotonic() - start, 1),
                                "cache_hit": result["cache_hit"], "evidence_count": result["trace"]["evidence_count"],
                                "citations": [c["title"] for c in result["citations"]],
                                "collected": result["trace"].get("collected_ids", []), "answer": result["answer"]})
                            print("generated", k, q["id"], flush=True)
        finally:
            store.close()
        print("done size", size, json.dumps(report["index"][size]), flush=True)

    save_json(base.chroma_path.parent / "evaluation" / "settings_comparison.json", report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
