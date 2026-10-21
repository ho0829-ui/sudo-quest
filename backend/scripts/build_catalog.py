"""후보 목록 + 한국어 주석 + 실제 원문 절 추출 결과로 catalog/items.json·documents.json을 만든다.

backend 폴더에서 실행:
  .venv/Scripts/python.exe -X utf8 -m scripts.build_catalog            # 생성
  .venv/Scripts/python.exe -X utf8 -m scripts.build_catalog --dump F   # 원문 절만 F에 저장(주석 작성용)

유료 API는 호출하지 않는다. 원문은 data/corpus 캐시를 재사용하며 없을 때만 내려받는다.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from app.catalog import CATALOG_DIR
from app.collectors import Collector, save_json
from app.config import load_settings

DEFAULT_CATEGORY = {"curl": "network", "linux-errno": "linux", "aws-alb": "aws"}
PRIMARY_SOURCE = {"curl": "curl-manpage", "linux-errno": "errno", "aws-alb": "alb-troubleshooting"}
MAN2_SOURCE = {"connect.2.html": "connect", "open.2.html": "open", "write.2.html": "write"}


def read(name):
    return json.loads((CATALOG_DIR / name).read_text(encoding="utf-8"))


def define(sources, doc_id, source, section, title):
    meta = sources[source]
    return {"doc_id": doc_id, "canonical_url": meta["url"], "section": section, "title": title,
            "product": meta["product"], "publisher": meta["publisher"], "license": meta["license"],
            "usage_terms_url": meta["usage_terms_url"], "source_name": source}


def error_codes(entry):
    # ALB 후보의 code 값은 절 이름(http-503-issues)이다. 실제 HTTP 상태 코드만 오류 코드로 쓴다.
    if entry["source"] == "aws-alb":
        status = re.fullmatch(r"http-(\d{3})-issues", entry["code"])
        return [status.group(1)] if status else []
    return [entry["code"]] if entry["code"] else []


def libcurl_anchors(html):
    # 'CURLE_COULDNT_CONNECT (7)' 형태의 제목에서 번호 → 앵커 이름을 만든다.
    found = re.findall(r'<a name="(CURLE\w+)"></a><span class="nroffip">(CURLE_\w+) \((\d+)\)', html)
    return {code: (anchor, name) for anchor, name, code in found}


def candidates(entry, sources, shared, annotation, anchors):
    """항목 하나의 (주 문서, 보조 문서 후보) 정의를 만든다."""
    source = entry["source"]
    if source == "linux-errno":
        name = entry["code"]
        primary = define(sources, entry["item_id"], "errno", "DESCRIPTION/" + name, "errno(3): " + name)
        pages = [MAN2_SOURCE[s["url"].rsplit("/", 1)[1]] for s in entry["supplemental_sources"]]
        extra = [define(sources, f"linux-{page}-{name}", page, "ERRORS/" + name, f"{page}(2) ERRORS: {name}")
                 for page in pages]
    else:
        section = entry["source_url"].split("#", 1)[1]
        prefix = "curl-exit-" if source == "curl" else "alb-"
        primary = define(sources, prefix + section, PRIMARY_SOURCE[source], section, entry["title_original"])
        extra = []
        if source == "curl" and entry["code"] in anchors:
            anchor, name = anchors[entry["code"]]
            extra.append(define(sources, "libcurl-" + entry["code"], "libcurl-errors", anchor,
                                f"libcurl {name} ({entry['code']})"))
    for doc_id in annotation.get("extra_docs", []):
        spec = shared[doc_id]
        extra.append(define(sources, doc_id, spec["source"], spec["section"], spec["title"]))
    return primary, extra


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dump", help="추출한 원문 절을 저장할 JSON 경로")
    args = parser.parse_args()

    shortlist, sources, shared = read("shortlist_100.json"), read("sources.json"), read("shared_documents.json")
    annotations = read("annotations_ko.json") if (CATALOG_DIR / "annotations_ko.json").exists() else {}
    all_defs = {f"_{k}": define(sources, k, k, "", "") for k in sources}
    collector = Collector(load_settings().chroma_path.parent / "corpus", all_defs)
    anchors = libcurl_anchors(collector.fetch(sources["libcurl-errors"]["url"])["html"])

    documents, items, dropped, dump, errors = {}, [], [], {}, []
    for entry in shortlist:
        item_id = entry["item_id"]
        annotation = annotations.get(item_id, {})
        primary, extra = candidates(entry, sources, shared, annotation, anchors)
        try:
            primary_text = collector.document(primary["doc_id"], {primary["doc_id"]: primary})["text"]
        except ValueError as exc:
            errors.append(f"{item_id}: primary {exc}")
            continue
        kept = []
        for doc in extra:
            try:
                collector.document(doc["doc_id"], {doc["doc_id"]: doc})
                kept.append(doc)
            except ValueError as exc:
                # 보조 문서는 없으면 빼고 기록한다. 주 문서는 빠지면 항목 전체가 실패다.
                dropped.append(f"{item_id}: {doc['doc_id']} {exc}")
        dump[item_id] = {"title_original": entry["title_original"], "primary": primary_text}
        for doc in [primary] + kept:
            documents[doc["doc_id"]] = {k: v for k, v in doc.items() if k != "source_name"}
        if not annotation:
            errors.append(f"{item_id}: annotation missing")
            continue
        items.append({
            "item_id": item_id, "title_ko": annotation["title_ko"], "title_original": entry["title_original"],
            "category": annotation.get("category", DEFAULT_CATEGORY[entry["source"]]),
            "product": sources[PRIMARY_SOURCE[entry["source"]]]["product"],
            "error_codes": error_codes(entry),
            "symptoms": annotation["symptoms"], "summary": annotation["summary"],
            "source_excerpt": primary_text[:600],
            "primary_doc_id": primary["doc_id"], "document_ids": [primary["doc_id"]] + [d["doc_id"] for d in kept],
            "source_url": entry["source_url"], "source_section": primary["section"],
            "applies_to_version": "수집 문서의 product_version·본문 해시 참조",
            "scenario_ids": annotation.get("scenario_ids", []),
            "annotation_origin": "원문 절 추출(영문) + LLM 보조 한국어 제목·증상·요약(원문 대조 검수 대기)",
        })

    if args.dump:
        save_json(Path(args.dump), dump)
    report = {"items": len(items), "documents": len(documents), "dropped_supplemental": dropped,
              "errors": errors, "http_requests": collector.requests}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        return 1
    save_json(CATALOG_DIR / "documents.json", documents)
    save_json(CATALOG_DIR / "items.json", items)
    return 0


if __name__ == "__main__":
    sys.exit(main())
