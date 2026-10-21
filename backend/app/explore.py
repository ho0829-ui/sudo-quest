"""자연어 조건 기반 항목 탐색(F2011).

명확한 조건(제품·오류 코드)은 프로그램이 먼저 거르고, 나머지 조건은 LLM이
후보의 공개 메타데이터로만 판정한다. 판정 뒤에도 명확한 조건 위반은 다시 제외한다.
"""
import json
import re

from pydantic import ValidationError

from app import prompts
from app.catalog import ITEMS, ITEM_BY_ID
from app.collectors import digest, save_json
from app.contracts import ExploreJudgement
from app.corpus import check_manifest
from app.providers import embed, generate

PROMPT_VERSION = "explore-2"
CANDIDATE_LIMIT = 20
# 'curl에서'처럼 한글 조사가 붙으므로 \b 대신 영문·숫자 경계를 쓴다.
PRODUCT_PATTERNS = {
    "curl": r"(?<![a-z0-9])(?:lib)?curl(?![a-z0-9])|컬",
    "Linux": r"linux|리눅스|errno|시스템\s*콜|system\s*call",
    "AWS ALB": r"(?<![a-z0-9])(?:alb|aws|elb)(?![a-z0-9])|로드\s*밸런서|load\s*balancer",
}
CATEGORY_LABELS = {
    "network": "네트워크", "http": "HTTP", "tls": "TLS·인증서", "filesystem": "파일 시스템",
    "permission": "권한", "resource": "자원", "process": "프로세스", "aws": "AWS",
}


def explicit_conditions(query: str) -> dict:
    """제품과 오류 코드처럼 문자 그대로 확인되는 조건만 뽑는다."""
    lowered = query.lower()
    products = [name for name, pattern in PRODUCT_PATTERNS.items() if re.search(pattern, lowered)]
    known_codes = {code for item in ITEMS for code in item.error_codes}
    # 'E'로 시작하는 errno 이름, 'HTTP 503' 같은 상태 코드, 'curl 7' 같은 종료 코드를 찾는다.
    # 한글 조사(ENOSPC나, 503에서)가 바로 붙을 수 있어 \b 대신 영문·숫자 경계를 쓴다.
    words = set(re.findall(r"(?<![A-Za-z0-9])E[A-Z0-9]{2,}(?![A-Za-z0-9])", query))
    words |= set(re.findall(r"(?:http|상태\s*코드|코드|exit|오류|에러|error)\s*(\d{1,3})(?!\d)", lowered))
    codes = sorted(code for code in words if code in known_codes)
    return {"products": products, "codes": codes}


def satisfies(item, conditions) -> bool:
    if conditions["products"] and item.product not in conditions["products"]:
        return False
    return not conditions["codes"] or bool(set(item.error_codes) & set(conditions["codes"]))


def find_candidates(settings, collections, query, conditions, embedder=None):
    if conditions["codes"]:
        # 코드는 의미 검색보다 정확하다. 코드가 있는 항목을 그대로 후보로 쓴다.
        return [item for item in ITEMS if satisfies(item, conditions)][:CANDIDATE_LIMIT]
    vector = (embedder or embed)(settings, [query])[0]
    where = {"product": {"$in": conditions["products"]}} if conditions["products"] else None
    found = collections["knowledge_items"].query(query_embeddings=[vector], n_results=CANDIDATE_LIMIT,
                                                 where=where, include=[])
    return [ITEM_BY_ID[item_id] for item_id in found["ids"][0] if item_id in ITEM_BY_ID]


def public_view(item):
    return {"item_id": item.item_id, "title_ko": item.title_ko, "title_original": item.title_original,
            "product": item.product, "category(작성자 분류)": item.category,
            "error_codes": item.error_codes, "symptoms": item.symptoms, "summary": item.summary}


def judge(settings, query, candidates):
    payload = json.dumps({"conditions": query, "candidates": [public_view(c) for c in candidates]},
                         ensure_ascii=False)
    for _ in range(2):
        try:
            return ExploreJudgement.model_validate_json(generate(settings, payload, prompts.EXPLORE, 3000))
        except ValidationError:
            continue
    raise ValueError("explore_judgement_invalid")


def search(settings, collections, query, progress=lambda stage: None):
    manifest = check_manifest(settings)
    conditions = explicit_conditions(query)
    key = digest(json.dumps({"query": " ".join(query.lower().split()), "corpus": manifest["corpus_hash"],
                             "model": settings.llm_model, "prompt": PROMPT_VERSION}, sort_keys=True))
    cache_path = settings.chroma_path.parent / "explore" / (key + ".json")
    if cache_path.exists():
        progress("cache")
        return {**json.loads(cache_path.read_text(encoding="utf-8")), "cache_hit": True}
    if settings.missing("generation") or settings.missing("embedding"):
        raise ValueError("provider_not_configured")
    progress("candidates")
    candidates = find_candidates(settings, collections, query, conditions)
    progress("judge")
    judgement = judge(settings, query, candidates) if candidates else ExploreJudgement(matches=[])
    allowed = {c.item_id for c in candidates}
    if any(m.item_id not in allowed for m in judgement.matches):
        raise ValueError("explore_judgement_invalid")
    reasons = {m.item_id: m.reason for m in judgement.matches}
    # 후보 순서(검색 순위)를 유지하고, 명확한 조건을 어긴 항목은 판정과 무관하게 뺀다.
    cards = [{"item_id": c.item_id, "title_ko": c.title_ko, "product": c.product,
              "category": CATEGORY_LABELS.get(c.category, c.category), "reason": reasons[c.item_id]}
             for c in candidates if c.item_id in reasons and satisfies(c, conditions)]
    notes = ["분류(네트워크·TLS 등)는 공식 문서가 아닌 작성자 분류입니다."]
    if not cards:
        notes.append("조건에 맞는 항목을 찾지 못했습니다. 조건을 줄이거나 다른 표현으로 다시 찾아보세요.")
    result = {"cards": cards, "applied_filters": conditions, "candidate_count": len(candidates),
              "rejected_by_filter": [m.item_id for m in judgement.matches
                                     if not satisfies(ITEM_BY_ID[m.item_id], conditions)],
              "unverifiable_conditions": judgement.unverifiable_conditions, "notes": notes, "cache_hit": False}
    save_json(cache_path, result)
    return result
