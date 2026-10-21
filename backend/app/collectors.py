import hashlib
import json
import re
import time
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests

from app.catalog import DOCUMENTS

AGENT = "InfraCoachLearning/0.1"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def save_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(path)


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if tag in ("p", "li", "pre", "h1", "h2", "h3", "tr", "br"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag in ("p", "li", "pre", "h1", "h2", "h3", "tr"):
            self.parts.append("\n")
        elif tag in ("td", "th"):
            self.parts.append(" | ")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def extract_man_entry(html: str, section: str) -> str:
    """man7.org 페이지에서 'h2 절/오류 이름' 단락만 뽑는다. 예: ERRORS/ECONNREFUSED."""
    heading, name = section.split("/", 1)
    # 제목 텍스트가 첫 단락에 섞이지 않도록 </h2> 뒤부터 읽는다.
    start = re.search(r'<h2><a id="' + re.escape(heading) + r'".*?</h2>', html, re.S)
    if not start:
        raise ValueError("source_section_missing")
    end = re.search(r"<h2>", html[start.end():])
    fragment = html[start.end():start.end() + end.start()] if end else html[start.end():]
    text = unescape(re.sub(r"<[^>]+>", "", fragment))
    # 단락은 빈 줄로 나뉜다. 같은 오류 이름이 조건별로 여러 번 나오므로 모두 모은다.
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text)]
    hits = [re.sub(r"\s+", " ", b) for b in blocks if re.match(re.escape(name) + r"(?![A-Z0-9_])", b)]
    if not hits:
        raise ValueError("source_section_missing")
    return "\n".join(hits)


def extract_section(html: str, url: str, section: str) -> str:
    # curl은 단락 앵커, man7은 오류 이름 단락, AWS는 제목 경계를 사용한다.
    # 절이 없으면 전체 본문으로 대체하지 않는다.
    host = urlsplit(url).hostname
    if host == "man7.org":
        return extract_man_entry(html, section)
    if host == "curl.se":
        pattern = r'<p class="level0">(?:(?!</p>).)*<a name="' + re.escape(section) + r'"'
        start = re.search(pattern, html, re.S)
        if not start:
            raise ValueError("source_section_missing")
        end = re.search(r'<p class="level0"><a name=|<h[12]', html[start.end():])
    else:
        start = re.search(r'<h[123][^>]*id="' + re.escape(section) + r'"[^>]*>', html)
        if not start:
            raise ValueError("source_section_missing")
        end = re.search(r'<h[123]\b', html[start.end():])
    fragment = html[start.start():start.end() + end.start()] if end else html[start.start():]
    parser = TextParser()
    parser.feed(fragment)
    text = "\n".join(re.sub(r"\s+", " ", line).strip() for line in "".join(parser.parts).splitlines() if line.strip())
    if len(text) < 20:
        raise ValueError("source_section_empty")
    return text


def product_version(html: str) -> str:
    for pattern in (r"This man page describes curl ([\d.]+)", r"Linux man-pages ([\d.]+)"):
        found = re.search(pattern, html)
        if found:
            return found.group(1).rstrip(".")
    return "rolling snapshot"


class Collector:
    def __init__(self, root: Path, documents: dict | None = None):
        documents = DOCUMENTS if documents is None else documents
        self.root = root
        self.requests = 0
        self.last_request = 0.0
        self.allowed = {d["canonical_url"] for d in documents.values()} | {d["usage_terms_url"] for d in documents.values()}

    def _request(self, url):
        time.sleep(max(0, 1 - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        self.requests += 1
        response = requests.get(url, headers={"User-Agent": AGENT}, timeout=30, allow_redirects=False)
        if response.status_code == 429:
            # 429는 자동 재시도하지 않는다. 제한 안내 이후 명시적으로 재실행한다.
            raise ValueError("source_rate_limited_retry_later")
        return response

    def fetch(self, url):
        if url not in self.allowed:
            raise ValueError("source_not_allowed")
        path = self.root / "raw" / (digest(url) + ".json")
        if path.exists():
            cached = json.loads(path.read_text(encoding="utf-8"))
            if digest(cached["html"]) != cached["content_hash"]:
                raise ValueError("source_cache_corrupt")
            return cached
        origin = "https://" + urlsplit(url).netloc
        robots_path = self.root / "robots" / (digest(origin) + ".json")
        if robots_path.exists():
            robots = json.loads(robots_path.read_text(encoding="utf-8"))
        else:
            r = self._request(origin + "/robots.txt")
            if r.status_code not in (200, 404):
                raise ValueError("robots_unavailable")
            robots = {"url": origin + "/robots.txt", "status": r.status_code, "text": r.text if r.status_code == 200 else ""}
            save_json(robots_path, robots)
        policy = RobotFileParser()
        policy.parse(robots["text"].splitlines())
        if robots["status"] == 200 and not policy.can_fetch(AGENT, url):
            raise ValueError("robots_disallow")
        r = self._request(url)
        if r.status_code != 200:
            raise ValueError("source_http_error")
        if "charset" not in r.headers.get("Content-Type", "").lower():
            # 헤더에 charset이 없으면 requests가 ISO-8859-1로 해석해 한글·대시가 깨진다.
            r.encoding = "utf-8"
        value = {"url": url, "html": r.text, "content_hash": digest(r.text),
                 "fetched_at": datetime.now(timezone.utc).isoformat(), "etag": r.headers.get("ETag", "")}
        save_json(path, value)
        return value

    def document(self, doc_id, documents: dict | None = None):
        definition = (DOCUMENTS if documents is None else documents)[doc_id]
        raw = self.fetch(definition["canonical_url"])
        text = extract_section(raw["html"], definition["canonical_url"], definition["section"])
        return {**definition, "text": text, "content_hash": digest(text),
                "source_url": definition["canonical_url"] + "#" + definition["section"],
                "fetched_at": raw["fetched_at"], "raw_hash": raw["content_hash"],
                "product_version": product_version(raw["html"]),
                "language": "en", "changes": "HTML 본문 절 추출·공백 정규화"}
