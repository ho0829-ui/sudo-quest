"""공개 실습 기록 기반 게임 코치(F2010).

입력은 플레이어에게 보이는 정보(티켓·연 힌트·직접 실행한 명령과 출력)뿐이다.
복구 판정은 게임 엔진이 하고, 코치는 관찰 사실과 공식 문서로 다음 점검을 안내한다.
"""
import json
import re

from pydantic import ValidationError

from app import prompts
from app.catalog import ITEM_BY_ID
from app.collectors import digest, save_json
from app.contracts import CoachAnswer, SearchTerms
from app.corpus import check_manifest
from app.graphs import build_graph
from app.timing import StageClock
from app.providers import embed
from app.rag import citation_numbers, json_call

PROMPT_VERSION = "coach-3"
AUTO_ITEMS = 3
OBSERVATION = re.compile(r"\[실습 기록\s*([\d,\s]+)\]")
COMMAND_IN_TEXT = re.compile(r"`([^`\n]+)`")
COMMAND_NAME = re.compile(r"[a-z][a-z0-9_-]*")


def observation_numbers(text):
    return {int(n) for group in OBSERVATION.findall(text) for n in group.split(",") if n.strip().isdigit()}


def numbered_observations(request):
    first = request.omitted_observations + 1
    return [{"observation_id": first + i, **o.model_dump()} for i, o in enumerate(request.observations)]


def validate_coach_answer(answer, evidence, observations):
    text = answer.answer + "\n" + "\n".join(answer.suggested_checks)
    docs, seen = citation_numbers(text), observation_numbers(text)
    if docs != set(answer.cited_evidence_ids) or not docs <= {e["evidence_id"] for e in evidence}:
        raise ValueError("invalid_citations")
    if seen != set(answer.cited_observation_ids) or not seen <= {o["observation_id"] for o in observations}:
        raise ValueError("invalid_observation_citations")
    if not docs and not seen and "문서에서 확인되지" not in answer.answer:
        raise ValueError("uncited_answer")
    return sorted(docs), sorted(seen)


def unsupported_commands(answer, available, operations=None):
    """제안에 가상 터미널에서 실행할 수 없는 명령이 있는데 '실제 환경 참고' 표시가 없으면 알린다.

    aws처럼 하위 명령 목록(operations)이 있는 명령은 하위 명령까지 본다. 예: aws cloudwatch는 지원하지 않음.
    하위 명령은 옵션(-로 시작)을 건너뛴 앞쪽 단어로 비교한다(프론트 supportsInvocation과 같은 규칙).
    """
    operations = operations or {}
    found = set()
    for check in answer.suggested_checks:
        if "실제 환경 참고" in check:
            continue
        for command in COMMAND_IN_TEXT.findall(check):
            words = command.split()
            if words and words[0] == "sudo":
                words = words[1:]
            if not words or not COMMAND_NAME.fullmatch(words[0]):
                continue  # `/var/log` 같은 경로나 문구는 명령이 아니다.
            name = words[0]
            if name not in available:
                found.add(name)
                continue
            if name in operations:
                positional = [w for w in words[1:] if not w.startswith("-")]
                if not any(positional[:len(op.split())] == op.split() for op in operations[name]):
                    found.add(" ".join([name, *positional[:2]]))
    return sorted(found)


def coach(settings, collections, request, progress=lambda stage: None):
    progress = StageClock(progress)
    manifest = check_manifest(settings)
    if request.item_id and request.item_id not in ITEM_BY_ID:
        raise ValueError("unknown_item")
    observations = numbered_observations(request)
    public = {"ticket": request.ticket, "revealed_hints": request.revealed_hints,
              "observations": observations, "omitted_observations": request.omitted_observations,
              "available_commands": request.available_commands, "command_operations": request.command_operations,
              "question": request.question,
              "history": [m.model_dump() for m in request.history],
              "selected_item": ITEM_BY_ID[request.item_id].model_dump() if request.item_id else None}
    key = digest(json.dumps({"public": public, "corpus": manifest["corpus_hash"], "model": settings.llm_model,
                             "top_k": settings.external_top_k, "prompt": PROMPT_VERSION}, sort_keys=True))
    cache_path = settings.chroma_path.parent / "coach" / (key + ".json")
    if cache_path.exists():
        progress("cache")
        return {**json.loads(cache_path.read_text(encoding="utf-8")), "cache_hit": True, "timings": progress.finish()}
    if settings.missing("generation") or settings.missing("embedding"):
        raise ValueError("provider_not_configured")
    warnings = []
    progress("search_terms")
    try:
        terms = json_call(settings, prompts.SEARCH, public, SearchTerms).queries
    except (ValidationError, ValueError):
        terms = [request.question[:200]]
        warnings.append("검색어 형식 오류로 질문을 그대로 검색어로 사용했습니다.")

    def retrieve(state):
        progress("retrieve")
        vector = embed(settings, [request.question + "\n" + "\n".join(terms)])[0]
        if request.item_id:
            item_ids = [request.item_id]
        else:
            # 숨겨진 시나리오-항목 연결은 쓰지 않는다. 질문과 관찰에서 나온 검색어로만 항목을 고른다.
            found = collections["knowledge_items"].query(query_embeddings=[vector], n_results=AUTO_ITEMS, include=[])
            item_ids = found["ids"][0]
        metadata = collections["knowledge_items"].get(ids=item_ids, include=["documents", "metadatas"])
        evidence = [{**meta, "text": text} for text, meta in zip(metadata["documents"], metadata["metadatas"])]
        chunks = collections["reference_chunks"].query(
            query_embeddings=[vector], n_results=settings.external_top_k,
            where={"item_id": {"$in": item_ids}}, include=["documents", "metadatas"])
        seen = set()
        for text, meta in zip(chunks["documents"][0], chunks["metadatas"][0]):
            if (meta["source_url"], digest(text)) not in seen:
                seen.add((meta["source_url"], digest(text)))
                evidence.append({**meta, "text": text})
        for number, entry in enumerate(evidence, start=1):
            entry["evidence_id"] = number
        return {"evidence": evidence}

    def generate_node(state):
        progress("generate")
        evidence = state["evidence"]
        answer = None
        for attempt in range(2):
            try:
                answer = json_call(settings, prompts.COACH, {
                    **public, "evidence": evidence,
                    "format_reminder": "인용 번호([근거 N], [실습 기록 N])와 JSON 형식을 다시 확인하세요." if attempt else "",
                }, CoachAnswer)
                validate_coach_answer(answer, evidence, observations)
                break
            except (ValueError, ValidationError):
                answer = None
        if answer is None:
            raise ValueError("citation_validation_failed")
        docs, seen = validate_coach_answer(answer, evidence, observations)
        extra = unsupported_commands(answer, request.available_commands, request.command_operations)
        if extra:
            warnings.append("가상 터미널에서 지원하지 않는 명령이 포함되어 있습니다: " + ", ".join(extra))
        return {"result": {
            "answer": answer.answer, "suggested_checks": answer.suggested_checks,
            "citations": [e for e in evidence if e["evidence_id"] in docs],
            "observations": [o for o in observations if o["observation_id"] in seen],
            "warnings": warnings + (["답변에 인용된 근거가 없습니다."] if not docs and not seen else []),
            "trace": {"queries": terms, "item_ids": sorted({e["item_id"] for e in evidence}),
                      "evidence_count": len(evidence), "graph_nodes": ["retrieve", "generate"]},
            "cache_hit": False,
        }}

    result = build_graph(retrieve, generate_node).invoke({"question": request.question})["result"]
    save_json(cache_path, result)
    # 소요 시간은 이번 요청의 값이라 캐시에 넣지 않는다(캐시 적중이면 그때 잰 값을 붙인다).
    return {**result, "timings": progress.finish()}
