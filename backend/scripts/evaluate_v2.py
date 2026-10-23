"""RAG 평가 v2(20번 정리 D1·D2). 질문·정답 절은 evaluation/rag_eval_v2.json에 실행 전에 고정해 두었다.

backend 폴더에서 실행:
  .venv/bin/python -X utf8 -m scripts.evaluate_v2 retrieval   # 검색만(생성 호출 없음, 질문 임베딩만·벡터는 캐시)
  .venv/bin/python -X utf8 -m scripts.evaluate_v2 answers     # 서비스 경로 그대로 답변까지(유료), 두 번째 실행은 캐시 적중
결과는 docs/infra-coach/evaluation/rag_eval_v2_<모드>.json. 키·질문 외 개인정보는 쓰지 않는다.
"""
import argparse
import json
import statistics
import time
from pathlib import Path

from app.catalog import ITEM_BY_ID
from app.coach import coach
from app.collectors import digest, save_json
from app.config import load_settings
from app.contracts import ChatRequest, CoachRequest
from app.indexing import open_store
from app.providers import ProviderError, embed
from app.rag import respond

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "evaluation" / "rag_eval_v2.json").read_text(encoding="utf-8"))
COACH_REQUESTS = json.loads((ROOT / "evaluation" / "coach_requests_v2.json").read_text(encoding="utf-8"))
OUT = ROOT.parent / "docs" / "infra-coach" / "evaluation"
ABSTAIN = "문서에서 확인되지"


def question_vectors(settings, texts):
    """질문 벡터는 data/ 아래에 캐시한다(다시 돌려도 임베딩 호출 0회)."""
    path = settings.chroma_path.parent / "evaluation" / "v2_question_vectors.json"
    cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    missing = [t for t in texts if digest(settings.embedding_model + t) not in cache]
    if missing:
        for text, vector in zip(missing, embed(settings, missing)):
            cache[digest(settings.embedding_model + text)] = vector
        save_json(path, cache)
    return [cache[digest(settings.embedding_model + t)] for t in texts], len(missing)


def first_rank(doc_ids, gold):
    return next((rank for rank, doc in enumerate(doc_ids, start=1) if doc in gold), None)


def evaluate_retrieval(settings, collections):
    questions = [q for q in SPEC["questions"] if q["kind"] == "in_corpus"]
    vectors, new = question_vectors(settings, [q["question"] for q in questions])
    rows = []
    for q, vector in zip(questions, vectors):
        item = ITEM_BY_ID[q["item_id"]]
        gold = set(q["gold_doc_ids"])
        # 서비스와 같은 범위: 고른 항목 + 그 항목에 연결된 문서(질문 중 수집·LLM 선별은 빼고 검색만 본다)
        scoped = collections["reference_chunks"].query(
            query_embeddings=[vector], n_results=settings.external_top_k, include=["documents", "metadatas"],
            where={"$and": [{"item_id": item.item_id}, {"doc_id": {"$in": item.document_ids}}]})
        scoped_docs = [m["doc_id"] for m in scoped["metadatas"][0]]
        text = "\n".join(scoped["documents"][0])
        # 항목을 모를 때: 전체 청크에서 검색, 그리고 코치처럼 knowledge_items에서 항목 3개 자동 선택
        wide = collections["reference_chunks"].query(query_embeddings=[vector], n_results=10, include=["metadatas"])
        wide_docs = [m["doc_id"] for m in wide["metadatas"][0]]
        items = collections["knowledge_items"].query(query_embeddings=[vector], n_results=3, include=[])["ids"][0]
        rank = first_rank(scoped_docs, gold)
        rows.append({"id": q["id"], "item_id": q["item_id"], "gold_doc_ids": sorted(gold),
                     "scoped_doc_ids": scoped_docs, "scoped_hit": rank is not None, "scoped_rr": round(1 / rank, 3) if rank else 0,
                     "markers_found": [m for m in q["markers"] if m in text], "markers_total": len(q["markers"]),
                     "global_hit_at_4": first_rank(wide_docs[:4], gold) is not None,
                     "global_hit_at_10": first_rank(wide_docs, gold) is not None,
                     "item_hit_at_3": q["item_id"] in items, "auto_items": items})
    n = len(rows)
    summary = {"questions": n, "embedding_calls_for_questions": 1 if new else 0, "top_k": settings.external_top_k,
               "scoped_hit_at_k": sum(r["scoped_hit"] for r in rows) / n,
               "scoped_mrr": round(sum(r["scoped_rr"] for r in rows) / n, 3),
               "markers_found": f'{sum(len(r["markers_found"]) for r in rows)}/{sum(r["markers_total"] for r in rows)}',
               "global_hit_at_4": sum(r["global_hit_at_4"] for r in rows) / n,
               "global_hit_at_10": sum(r["global_hit_at_10"] for r in rows) / n,
               "item_auto_select_hit_at_3": sum(r["item_hit_at_3"] for r in rows) / n}
    return {"summary": summary, "rows": rows}


def run_one(settings, collections, call):
    start = time.monotonic()
    try:
        result = call()
        return {"seconds": round(time.monotonic() - start, 2), **result}
    except (ValueError, ProviderError) as exc:
        return {"seconds": round(time.monotonic() - start, 2), "error": str(exc)}


def answer_row(spec, result):
    cited = [c.get("doc_id") for c in result.get("citations", []) if c.get("doc_id")]
    gold = set(spec.get("gold_doc_ids", []))
    trace = result.get("trace", {})
    return {"id": spec["id"], "kind": spec["kind"], "seconds": result["seconds"], "error": result.get("error"),
            "cache_hit": result.get("cache_hit"), "timings": result.get("timings"),
            "abstained": ABSTAIN in result.get("answer", ""), "selected_ids": trace.get("selected_ids"),
            "auto_item_ids": trace.get("item_ids"), "cited_doc_ids": cited,
            "gold_selected": bool(gold & set(trace.get("selected_ids") or [])) if gold else None,
            "gold_cited": bool(gold & set(cited)) if gold else None,
            "item_hit_at_3": bool(set(spec.get("gold_item_ids", [])) & set(trace.get("item_ids") or [])) if spec["kind"] == "coach" else None,
            "observations_cited": len(result.get("observations", [])) if spec["kind"] == "coach" else None,
            "answer": result.get("answer"), "suggested_checks": result.get("suggested_checks"), "warnings": result.get("warnings")}


def evaluate_answers(settings, collections):
    rows = []
    for spec in SPEC["questions"]:
        request = ChatRequest(item_id=spec["item_id"], question=spec["question"])
        rows.append(answer_row(spec, run_one(settings, collections, lambda: respond(settings, collections, request))))
        print(spec["id"], rows[-1]["seconds"], rows[-1]["error"] or "ok", flush=True)
    for spec in SPEC["coach"]:
        request = CoachRequest.model_validate(COACH_REQUESTS[spec["scenario"]])
        rows.append(answer_row(spec, run_one(settings, collections, lambda: coach(settings, collections, request))))
        print(spec["id"], rows[-1]["seconds"], rows[-1]["error"] or "ok", flush=True)
    return {"model": settings.llm_model, "embedding_model": settings.embedding_model, "top_k": settings.external_top_k,
            "rows": rows, "summary": summarize(rows)}


def percentile(values, p):
    values = sorted(values)
    return round(values[min(len(values) - 1, int(round(p / 100 * (len(values) - 1))))], 2) if values else None


def summarize(rows):
    ok = [r for r in rows if not r["error"]]
    inside = [r for r in ok if r["kind"] == "in_corpus"]
    outside = [r for r in ok if r["kind"] == "out_of_corpus"]
    fresh = [r["seconds"] for r in ok if not r["cache_hit"]]
    cached = [r["seconds"] for r in ok if r["cache_hit"]]
    stages = {}
    for r in ok:
        for name, sec in ((r["timings"] or {}).get("stages") or {}).items():
            stages.setdefault(name, []).append(sec)
    return {"answered": len(ok), "errors": {r["id"]: r["error"] for r in rows if r["error"]},
            "gold_selected": f'{sum(bool(r["gold_selected"]) for r in inside)}/{len(inside)}',
            "gold_cited": f'{sum(bool(r["gold_cited"]) for r in inside)}/{len(inside)}',
            "abstained_in_corpus": f'{sum(r["abstained"] for r in inside)}/{len(inside)}',
            "abstained_out_of_corpus": f'{sum(r["abstained"] for r in outside)}/{len(outside)}',
            "coach_item_hit_at_3": f'{sum(bool(r["item_hit_at_3"]) for r in ok if r["kind"] == "coach")}/{sum(r["kind"] == "coach" for r in ok)}',
            "latency_fresh": {"n": len(fresh), "p50": percentile(fresh, 50), "p95": percentile(fresh, 95),
                              "mean": round(statistics.mean(fresh), 2) if fresh else None},
            "latency_cached": {"n": len(cached), "p50": percentile(cached, 50), "p95": percentile(cached, 95)},
            "stage_p50": {name: percentile(v, 50) for name, v in stages.items()}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["retrieval", "answers"])
    parser.add_argument("--label", default="", help="결과 파일 이름 뒤에 붙일 말(예: pass2)")
    args = parser.parse_args()
    settings = load_settings()
    store, collections = open_store(settings.chroma_path)
    try:
        result = evaluate_retrieval(settings, collections) if args.mode == "retrieval" else evaluate_answers(settings, collections)
        name = f"rag_eval_v2_{args.mode}{'_' + args.label if args.label else ''}.json"
        save_json(OUT / name, {"run_at": time.strftime("%Y-%m-%d %H:%M"), **result})
        print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    finally:
        store.close()
