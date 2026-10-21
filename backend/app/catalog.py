"""검토한 10개 주제와 고정 공식 문서 허용 목록. URL은 모델이 생성하지 않는다."""
from pydantic import BaseModel

CURL = "https://curl.se/docs/manpage.html"
ALB = "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html"
HEALTH = "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html"


class KnowledgeItem(BaseModel):
    item_id: str
    title_ko: str
    title_original: str
    category: str
    product: str
    error_codes: list[str]
    symptoms: list[str]
    summary: str
    primary_doc_id: str
    document_ids: list[str]
    source_url: str
    source_section: str
    applies_to_version: str
    scenario_ids: list[str] = []
    annotation_origin: str = "공식 원문 기반 한국어 정리·작성자 분류"


DOCUMENTS = {}
ITEMS = []


def doc(doc_id, url, section, title, product):
    DOCUMENTS[doc_id] = {
        "doc_id": doc_id, "canonical_url": url, "section": section,
        "title": title, "product": product,
        "publisher": "curl contributors" if product == "curl" else "Amazon Web Services",
        "usage_terms_url": "https://curl.se/docs/copyright.html" if product == "curl" else "https://aws.amazon.com/terms/",
        "license": "curl" if product == "curl" else "CC-BY-SA-4.0",
    }


for option in ("resolve", "connect-timeout", "max-time", "output", "verbose", "cacert"):
    doc("curl-option-" + option, CURL, "--" + option, "curl --" + option, "curl")
doc("alb-health-overview", HEALTH, "target-group-health-checks", "ALB health checks and fail-open", "AWS ALB")
doc("alb-health-states", HEALTH, "target-health-states", "ALB target health status", "AWS ALB")

for code, title, original, summary, extra in [
    ("6", "호스트 이름 해석 실패", "Could not resolve host", "원격 호스트 이름을 해석하지 못한 오류다. 연결 실패 코드 7과 구분한다.", ["resolve"]),
    ("7", "호스트 연결 실패", "Failed to connect to host", "호스트에 연결하지 못한 오류다. 코드만으로 방화벽·서비스 중단을 확정하지 않는다.", ["connect-timeout", "verbose"]),
    ("23", "로컬 출력 쓰기 실패", "Write error", "로컬 파일 시스템 또는 유사한 출력 대상으로 데이터를 쓰지 못한 오류다. 디스크 부족으로만 단정하지 않는다.", ["output"]),
    ("28", "작업 시간 제한 초과", "Operation timeout", "설정된 조건의 시간 제한에 도달했다. 연결 시간 제한과 전체 전송 시간 제한을 구분한다.", ["connect-timeout", "max-time"]),
    ("35", "TLS 연결 오류", "SSL connect error", "SSL/TLS 연결 과정의 오류다. 자세한 오류 메시지와 연결 맥락을 확인해야 한다.", ["verbose"]),
    ("60", "서버 인증서 검증 실패", "Peer certificate cannot be authenticated", "알려진 CA 인증서로 상대 인증서를 인증할 수 없는 오류다. 만료만을 의미하지 않는다.", ["cacert"]),
]:
    did = "curl-exit-" + code
    doc(did, CURL, code, f"curl exit {code}: {original}", "curl")
    ITEMS.append(KnowledgeItem(
        item_id="curl-" + code, title_ko=title, title_original=original,
        category="network" if code != "23" else "linux", product="curl",
        error_codes=[code], symptoms=[original], summary=summary,
        primary_doc_id=did, document_ids=[did] + ["curl-option-" + x for x in extra],
        source_url=CURL + "#" + code, source_section="Exit codes / " + code,
        applies_to_version="수집한 curl 매뉴얼의 버전 및 본문 해시 참조",
    ))

for section, title, summary, codes in [
    ("target-not-inservice", "ALB 타깃이 서비스에 참여하지 못함", "등록된 타깃의 헬스체크 통과 여부와 관련 설정을 확인하는 주제다.", []),
    ("http-502-issues", "ALB HTTP 502 오류", "ALB가 생성하는 502의 가능한 원인을 타깃 연결·응답 조건에서 확인한다.", ["502"]),
    ("http-503-issues", "ALB HTTP 503 오류", "등록 타깃이 없거나 모두 unused인 경우 등을 확인한다. 모두 unhealthy인 경우의 fail-open과 구분한다.", ["503"]),
    ("http-504-issues", "ALB HTTP 504 오류", "ALB와 타깃 사이의 연결·응답 시간 제한 등 가능한 원인을 확인한다.", ["504"]),
]:
    did = "alb-" + section
    doc(did, ALB, section, title, "AWS ALB")
    ITEMS.append(KnowledgeItem(
        item_id="aws-alb-" + section, title_ko=title, title_original=section,
        category="aws", product="AWS ALB", error_codes=codes, symptoms=[title], summary=summary,
        primary_doc_id=did, document_ids=[did, "alb-health-overview", "alb-health-states"],
        source_url=ALB + "#" + section, source_section=section,
        applies_to_version="AWS rolling documentation; 수집 시각·본문 해시로 스냅샷 식별",
    ))

ITEM_BY_ID = {item.item_id: item for item in ITEMS}


def item_text(item: KnowledgeItem) -> str:
    return "\n".join([item.title_ko, item.title_original, item.product, item.category,
                      " ".join(item.error_codes), " ".join(item.symptoms), item.summary])
