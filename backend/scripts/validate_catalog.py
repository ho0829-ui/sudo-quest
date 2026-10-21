"""catalog/items.json·documents.json이 실제 원문과 맞는지 검사한다. 유료 API는 호출하지 않는다.

backend 폴더에서 실행: .venv/Scripts/python.exe -X utf8 -m scripts.validate_catalog
검사: 고유 항목 100건 이상, 모든 문서 절 추출 성공, 원문 발췌 일치, 출처·라이선스 기록,
라이선스가 허용 목록(app.catalog.ALLOWED_LICENSES)에 있는지.
실패가 하나라도 있으면 종료 코드 1.
"""
import json
import sys
from collections import Counter

from app.catalog import ALLOWED_LICENSES, DOCUMENTS, ITEMS
from app.collectors import Collector
from app.config import load_settings

MIN_ITEMS = 100


def main() -> int:
    collector = Collector(load_settings().chroma_path.parent / "corpus")
    failures, texts = [], {}
    for doc_id, doc in DOCUMENTS.items():
        try:
            texts[doc_id] = collector.document(doc_id)["text"]
        except ValueError as exc:
            failures.append(f"{doc_id}: {exc}")
        if not doc["license"] or not doc["usage_terms_url"]:
            failures.append(f"{doc_id}: license_missing")
        elif doc["license"] not in ALLOWED_LICENSES:
            failures.append(f"{doc_id}: license_not_allowed ({doc['license']})")
    if len(ITEMS) < MIN_ITEMS:
        failures.append(f"items: {len(ITEMS)} < {MIN_ITEMS}")
    for item in ITEMS:
        primary = texts.get(item.primary_doc_id, "")
        # 발췌가 원문과 다르면 원문이 바뀐 것이다. 재생성(build_catalog) 후 다시 검수한다.
        if item.source_excerpt and not primary.startswith(item.source_excerpt):
            failures.append(f"{item.item_id}: source_excerpt_mismatch")
    report = {
        "items": len(ITEMS),
        "unique_item_ids": len({i.item_id for i in ITEMS}),
        "documents": len(DOCUMENTS),
        "by_product": Counter(i.product for i in ITEMS),
        "by_category": Counter(i.category for i in ITEMS),
        "items_with_supplemental_docs": sum(len(i.document_ids) > 1 for i in ITEMS),
        "primary_under_80_chars": sum(len(texts.get(i.primary_doc_id, "")) < 80 for i in ITEMS),
        "licenses": Counter(d["license"] for d in DOCUMENTS.values()),
        "http_requests": collector.requests,
        "failures": failures,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
