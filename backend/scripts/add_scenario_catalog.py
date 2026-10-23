"""실습 시나리오를 뒷받침하는 공식 문서 절을 지식 카탈로그에 합친다.

backend 폴더에서 실행: .venv/bin/python -X utf8 -m scripts.add_scenario_catalog
- catalog/scenario_sources.json의 출처·항목 정의를 읽는다(한국어 메타데이터는 사람이 원문을 읽고 작성).
- 원문은 Collector로 받는다(robots.txt 확인, 1초 간격, data/corpus 캐시). 이용 조건 페이지도 함께 받는다.
- 원문 발췌(source_excerpt)는 추출한 절의 앞부분을 줄 단위로 잘라 쓴다. validate_catalog가 원문과 다시 대조한다.
- 같은 item_id가 이미 있으면 바꿔 끼운다. 여러 번 실행해도 결과가 같다.
"""
import json
import sys

from app.catalog import ALLOWED_LICENSES, CATALOG_DIR, KnowledgeItem, SourceDocument
from app.collectors import Collector
from app.config import load_settings

EXCERPT_LIMIT = 300
ORIGIN = "원문 절 추출(영문) + Claude가 원문을 읽고 쓴 한국어 제목·증상·요약(사람 검수 대기)"


def excerpt(text: str) -> str:
    """앞 300자 안에서 마지막 줄바꿈까지. 줄이 하나뿐이면 그 줄 전체(원문 접두어 조건은 그대로 만족)."""
    head = text[:EXCERPT_LIMIT]
    cut = head.rfind("\n")
    return head[:cut] if cut > 0 else text.split("\n", 1)[0]


def main() -> int:
    spec = json.loads((CATALOG_DIR / "scenario_sources.json").read_text(encoding="utf-8"))
    documents = json.loads((CATALOG_DIR / "documents.json").read_text(encoding="utf-8"))
    items = json.loads((CATALOG_DIR / "items.json").read_text(encoding="utf-8"))
    new_ids = {entry["item_id"] for entry in spec["items"]}

    new_docs = {}
    for entry in spec["items"]:
        source = spec["sources"][entry["source"]]
        if source["license"] not in ALLOWED_LICENSES:
            raise SystemExit(f"license_not_allowed: {entry['item_id']} ({source['license']})")
        new_docs[entry["item_id"]] = SourceDocument(
            doc_id=entry["item_id"], canonical_url=source["url"], section=entry["section"],
            title=entry["title_original"], product=source["product"], publisher=source["publisher"],
            license=source["license"], usage_terms_url=source["usage_terms_url"]).model_dump()

    collector = Collector(load_settings().chroma_path.parent / "corpus", new_docs)
    for url in sorted({doc["usage_terms_url"] for doc in new_docs.values()}):
        collector.fetch(url)

    new_items = []
    for entry in spec["items"]:
        doc = new_docs[entry["item_id"]]
        text = collector.document(entry["item_id"], new_docs)["text"]
        new_items.append(KnowledgeItem(
            item_id=entry["item_id"], title_ko=entry["title_ko"], title_original=entry["title_original"],
            category=entry["category"], product=doc["product"], error_codes=entry["error_codes"],
            symptoms=entry["symptoms"], summary=entry["summary"], source_excerpt=excerpt(text),
            primary_doc_id=entry["item_id"], document_ids=[entry["item_id"]],
            source_url=f"{doc['canonical_url']}#{doc['section']}", source_section=doc["section"],
            applies_to_version="수집 문서의 product_version·본문 해시 참조",
            scenario_ids=entry.get("scenario_ids", []), annotation_origin=ORIGIN).model_dump())

    documents = {key: value for key, value in documents.items() if key not in new_ids} | new_docs
    items = [item for item in items if item["item_id"] not in new_ids] + new_items
    (CATALOG_DIR / "documents.json").write_text(json.dumps(documents, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (CATALOG_DIR / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    by_product: dict[str, int] = {}
    for item in new_items:
        by_product[item["product"]] = by_product.get(item["product"], 0) + 1
    print(json.dumps({"added_or_replaced": len(new_items), "by_product": by_product, "total_items": len(items),
                      "http_requests": collector.requests}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
