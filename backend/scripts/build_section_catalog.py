"""허용한 공식 페이지의 모든 절을 목록으로 만든다 → catalog/section_catalog.json.

질문 시 외부 후보 검색(F2004)은 이 목록에서 키워드로 후보를 찾는다.
backend 폴더에서 실행: .venv/Scripts/python.exe -X utf8 -m scripts.build_section_catalog
원문은 data/corpus 캐시를 쓰며, 없을 때만 내려받는다. 유료 API는 호출하지 않는다.
"""
import json
import re
import sys
from html import unescape

from app.catalog import CATALOG_DIR, DOCUMENTS
from app.collectors import Collector, digest, extract_section, save_json
from app.config import load_settings

SUMMARY_CHARS = 240


def curl_sections(html, source):
    # 한 단락에 '-v'와 '--verbose'처럼 앵커가 여러 개 있을 수 있어 단락 안의 앵커를 모두 본다.
    paragraphs = re.findall(r'<p class="level0">((?:(?!</p>).)*)</p>', html, re.S)
    names = [name for p in paragraphs for name in re.findall(r'<a name="([^"]+)"', p)]
    for name in dict.fromkeys(names):
        if source == "libcurl-errors":
            # libcurl 페이지에는 CURLM·CURLSH 등 다른 API 오류도 있다. CURLcode(CURLE_*)만 쓴다.
            if name.startswith("CURLE"):
                yield name, None
        elif name.isdigit():
            yield name, "curl-exit-" + name
        elif name.startswith("--"):
            yield name, "curl-option-" + name[2:]


def man_sections(html, source):
    heading = "DESCRIPTION" if source == "errno" else "ERRORS"
    start = re.search(r'<h2><a id="' + heading + r'".*?</h2>', html, re.S)
    end = re.search(r"<h2>", html[start.end():])
    text = unescape(re.sub(r"<[^>]+>", "", html[start.end():start.end() + end.start()]))
    names = re.findall(r"^\s{7}(E[A-Z0-9]+)\b", text, re.M)
    prefix = "linux-errno-" if source == "errno" else f"linux-{source}-"
    for name in dict.fromkeys(names):
        yield heading + "/" + name, prefix + name


def aws_sections(html, source):
    for section in dict.fromkeys(re.findall(r'<h[123][^>]*id="([^"]+)"', html)):
        yield section, ("alb-" if source == "alb-troubleshooting" else "alb-health-") + section


def main() -> int:
    sources = json.loads((CATALOG_DIR / "sources.json").read_text(encoding="utf-8"))
    defs = {k: {"canonical_url": v["url"], "usage_terms_url": v["usage_terms_url"]} for k, v in sources.items()}
    collector = Collector(load_settings().chroma_path.parent / "corpus", defs)
    # 이미 카탈로그에 있는 (URL, 절)은 같은 doc_id를 재사용해 색인 청크와 어긋나지 않게 한다.
    known = {(d["canonical_url"], d["section"]): key for key, d in DOCUMENTS.items()}
    entries, skipped = {}, 0
    for source, meta in sources.items():
        html = collector.fetch(meta["url"])["html"]
        host = meta["url"].split("/")[2]
        lister = curl_sections if host == "curl.se" else man_sections if host == "man7.org" else aws_sections
        for section, default_id in lister(html, source):
            try:
                text = extract_section(html, meta["url"], section)
            except ValueError:
                skipped += 1
                continue
            lines = text.split("\n")
            first_line = lines[0][:120]
            doc_id = known.get((meta["url"], section)) or default_id
            if section.isdigit() and len(lines) > 1:  # curl 종료 코드 제목은 숫자뿐이라 설명을 붙인다.
                first_line = f"curl exit {section}: {lines[1][:100]}"
            if host == "man7.org":  # man 페이지 단락은 첫 줄이 본문이라 '페이지(절): 이름'으로 쓴다.
                name = section.split("/", 1)[1]
                first_line = f"errno(3): {name}" if source == "errno" else f"{source}(2) ERRORS: {name}"
            if doc_id is None:  # libcurl: 'CURLE_X (N)' 제목의 번호로 ID를 만든다.
                code = re.search(r"\((\d+)\)", first_line)
                doc_id = "libcurl-" + (code.group(1) if code else section)
            entries[doc_id] = {
                "doc_id": doc_id, "canonical_url": meta["url"], "section": section, "title": first_line,
                "summary": re.sub(r"\s+", " ", text)[:SUMMARY_CHARS], "product": meta["product"],
                "publisher": meta["publisher"], "license": meta["license"],
                "usage_terms_url": meta["usage_terms_url"], "source_name": source,
            }
    version = digest(json.dumps(entries, sort_keys=True, ensure_ascii=False))[:16]
    save_json(CATALOG_DIR / "section_catalog.json", {"version": version, "sections": entries})
    counts = {}
    for entry in entries.values():
        counts[entry["source_name"]] = counts.get(entry["source_name"], 0) + 1
    print(json.dumps({"version": version, "sections": len(entries), "by_source": counts,
                      "skipped": skipped, "http_requests": collector.requests}, ensure_ascii=False, indent=2))
    missing = [key for key in DOCUMENTS if key not in entries]
    if missing:
        # 항목에 연결된 문서는 모두 카탈로그 안에 있어야 후보 검색과 같은 ID 체계를 쓴다.
        print(json.dumps({"catalog_documents_missing": missing}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
