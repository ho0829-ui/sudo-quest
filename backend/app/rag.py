import json
import re

from pydantic import ValidationError

from app import discovery, prompts
from app.catalog import ITEM_BY_ID
from app.collectors import digest, save_json
from app.contracts import Answer, SearchTerms, Selection
from app.corpus import check_manifest
from app.graphs import build_graph
from app.providers import generate, embed

PROMPT_VERSION = "discovery-1"
CITATION = re.compile(r"\[근거\s*([\d,\s]+)\]")


def citation_numbers(text):
    return {int(n) for group in CITATION.findall(text) for n in group.split(",") if n.strip().isdigit()}


def validate_answer(answer, evidence):
    mentioned = citation_numbers(answer.answer + "\n" + "\n".join(answer.suggested_checks))
    available = {e["evidence_id"] for e in evidence}
    if mentioned != set(answer.cited_evidence_ids) or not mentioned <= available:
        raise ValueError("invalid_citations")
    if not mentioned and "문서에서 확인되지" not in answer.answer:
        raise ValueError("uncited_answer")
    return sorted(mentioned)


def json_call(settings, system, payload, schema):
    text = generate(settings, json.dumps(payload, ensure_ascii=False), system, 2000)
    return schema.model_validate_json(text)


def respond(settings, collections, request, progress=lambda stage: None):
    manifest = check_manifest(settings)
    item = ITEM_BY_ID[request.item_id]
    payload = {"item": item.model_dump(), "question": request.question,
               "history": [m.model_dump() for m in request.history]}
    cache_key = digest(json.dumps({"payload": payload, "corpus": manifest["corpus_hash"],
                                  "model": settings.llm_model, "url": settings.llm_base_url,
                                  "top_k": settings.external_top_k, "prompt": PROMPT_VERSION}, sort_keys=True))
    cache_path = settings.chroma_path.parent / "answers" / (cache_key + ".json")
    if cache_path.exists():
        progress("cache")
        result = json.loads(cache_path.read_text(encoding="utf-8"))
        return {**result, "cache_hit": True}
    if settings.missing("generation") or settings.missing("embedding"):
        raise ValueError("provider_not_configured")
    warnings = []
    progress("search_terms")
    try:
        terms = json_call(settings, prompts.SEARCH, payload, SearchTerms).queries
        if any(len(term) > 200 or not term.strip() for term in terms):
            raise ValueError("invalid_search_terms")
    except (ValidationError, ValueError):
        terms = [item.title_original, request.question[:200]]
        warnings.append("검색어 형식 오류로 항목명·질문 기반 검색어를 사용했습니다.")
    # 같은 항목·같은 검색어면 후보 검색과 선별을 다시 하지 않는다(NF2002).
    query_path = discovery.query_cache_path(settings, item.item_id, terms)
    if query_path.exists():
        progress("select_cache")
        cached = json.loads(query_path.read_text(encoding="utf-8"))
        candidate_ids, selected_ids, reasons = cached["candidate_ids"], cached["selected_ids"], cached["reasons"]
    else:
        candidates = discovery.find_candidates(item, terms, settings.candidate_limit)
        candidate_ids = [c["doc_id"] for c in candidates]
        progress("select_documents")
        selection = json_call(settings, prompts.SELECT, {
            **payload, "queries": terms, "candidates": [discovery.candidate_view(c) for c in candidates]}, Selection)
        selected_ids, reasons = discovery.finalize_selection(item, selection, candidates, settings.max_selected_documents)
        save_json(query_path, {"queries": terms, "candidate_ids": candidate_ids,
                               "selected_ids": selected_ids, "reasons": reasons})
    progress("collect")
    collection = discovery.ensure_indexed(settings, collections, item, selected_ids, manifest["dimensions"])

    def retrieve(state):
        progress("retrieve")
        metadata = collections["knowledge_items"].get(ids=[item.item_id], include=["documents", "metadatas"])
        if not metadata["ids"]:
            raise ValueError("selected_item_not_indexed")
        vector = embed(settings, [request.question + "\n" + "\n".join(terms)])[0]
        if len(vector) != manifest["dimensions"]:
            raise ValueError("embedding_dimension_changed")
        result = collections["reference_chunks"].query(
            query_embeddings=[vector], n_results=settings.external_top_k,
            where={"$and": [{"item_id": item.item_id}, {"doc_id": {"$in": selected_ids}}]},
            include=["documents", "metadatas"],
        )
        evidence = [{**metadata["metadatas"][0], "text": metadata["documents"][0], "evidence_id": 1}]
        seen = set()
        for text, meta in zip(result["documents"][0], result["metadatas"][0]):
            key = (meta["source_url"], digest(text))
            if key not in seen:
                evidence.append({**meta, "text": text, "evidence_id": len(evidence) + 1})
                seen.add(key)
        return {"evidence": evidence}

    def generate_node(state):
        progress("generate")
        evidence = state["evidence"]
        if len(evidence) < 2:
            answer = Answer(answer="문서에서 확인되지 않습니다. 상세 문서 근거가 부족합니다.", cited_evidence_ids=[])
        else:
            answer = None
            for attempt in range(2):
                try:
                    answer = json_call(settings, prompts.ANSWER, {
                        **payload, "evidence": evidence,
                        "format_reminder": "인용 번호와 JSON 형식을 다시 확인하세요." if attempt else "",
                    }, Answer)
                    validate_answer(answer, evidence)
                    break
                except (ValueError, ValidationError):
                    answer = None
            if answer is None:
                raise ValueError("citation_validation_failed")
        used = validate_answer(answer, evidence)
        # warnings는 모델 자유 텍스트를 노출하지 않고 검증 안내만 제공한다.
        return {"answer": answer.answer, "result": {
            "answer": answer.answer, "suggested_checks": answer.suggested_checks,
            "citations": [e for e in evidence if e["evidence_id"] in used],
            "warnings": warnings + (["답변에 인용된 근거가 없습니다."] if not used else []),
            "trace": {"queries": terms, "candidate_ids": candidate_ids, "selected_ids": selected_ids,
                      "excluded_ids": [d for d in candidate_ids if d not in selected_ids],
                      "reasons": reasons, "collected_ids": collection["collected"],
                      "collect_embedding_calls": collection["embedding_calls"],
                      "evidence_count": len(evidence), "graph_nodes": ["retrieve", "generate"]},
            "cache_hit": False,
        }}

    result = build_graph(retrieve, generate_node).invoke({"question": request.question})["result"]
    save_json(cache_path, result)
    return result
