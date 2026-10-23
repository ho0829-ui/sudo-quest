"""SUDO QUEST 제출 문서용 SVG 파이프라인 도식. Python 표준 라이브러리만 사용."""

from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "docs" / "assets" / "pipelines"
OUT.mkdir(parents=True, exist_ok=True)

CYAN = "#52dfff"
GREEN = "#6df4a0"
VIOLET = "#b99bff"
AMBER = "#ffbd77"
PINK = "#ff82c8"


def base(title: str, subtitle: str, height: int) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{height}" viewBox="0 0 1600 {height}" role="img" aria-label="{escape(title)}">',
        f'<title>{escape(title)}</title>',
        f'<desc>{escape(subtitle)}</desc>',
        "<defs>",
        '<linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0a101a"/><stop offset="1" stop-color="#111c2c"/></linearGradient>',
        '<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="#26384b" stroke-opacity=".35" stroke-width="1"/></pattern>',
        '<marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M2 2 L10 6 L2 10" fill="none" stroke="#7fa4bb" stroke-width="2"/></marker>',
        "</defs>",
        f'<rect width="1600" height="{height}" rx="28" fill="url(#bg)"/>',
        f'<rect width="1600" height="{height}" rx="28" fill="url(#grid)"/>',
        '<path d="M56 120 H1544" stroke="#314657" stroke-width="2"/>',
        '<circle cx="68" cy="58" r="6" fill="#ff758b"/><circle cx="90" cy="58" r="6" fill="#ffc56c"/><circle cx="112" cy="58" r="6" fill="#67e8a1"/>',
        '<text x="145" y="65" fill="#8ba9bd" font-size="20" font-weight="700" letter-spacing="3" font-family="ui-monospace,Menlo,monospace">SUDO QUEST / ARCHITECTURE</text>',
        f'<text x="58" y="107" fill="#f1f7ff" font-size="38" font-weight="800" font-family="Pretendard,Noto Sans KR,Apple SD Gothic Neo,sans-serif">{escape(title)}</text>',
        f'<text x="1544" y="105" text-anchor="end" fill="#88a2b5" font-size="18" font-family="Pretendard,Noto Sans KR,Apple SD Gothic Neo,sans-serif">{escape(subtitle)}</text>',
    ]


def card(svg: list[str], x: int, y: int, w: int, h: int, code: str, title: str,
         lines: list[str], color: str) -> None:
    svg.extend([
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="20" fill="#131f2e" stroke="{color}" stroke-opacity=".72" stroke-width="2"/>',
        f'<path d="M{x+22} {y+2} H{x+w-22}" stroke="{color}" stroke-width="4" stroke-linecap="round"/>',
        f'<circle cx="{x+30}" cy="{y+34}" r="5" fill="{color}"/>',
        f'<text x="{x+48}" y="{y+41}" fill="{color}" font-size="17" font-weight="700" letter-spacing="2" font-family="ui-monospace,Menlo,monospace">{escape(code)}</text>',
        f'<text x="{x+28}" y="{y+91}" fill="#f3f8ff" font-size="26" font-weight="800" font-family="Pretendard,Noto Sans KR,Apple SD Gothic Neo,sans-serif">{escape(title)}</text>',
    ])
    for i, line in enumerate(lines):
        svg.append(
            f'<text x="{x+28}" y="{y+130+i*31}" fill="#a9bdcd" font-size="20" '
            f'font-family="Pretendard,Noto Sans KR,Apple SD Gothic Neo,sans-serif">{escape(line)}</text>'
        )
    svg.append(f'<path d="M{x+27} {y+h-19} H{x+w-27}" stroke="#2b3c4e" stroke-width="1"/>')


def arrow(svg: list[str], x1: int, y1: int, x2: int, y2: int, dashed: bool = False) -> None:
    dash = ' stroke-dasharray="8 7"' if dashed else ""
    svg.append(
        f'<path d="M{x1} {y1} L{x2} {y2}" fill="none" stroke="#7fa4bb" '
        f'stroke-width="3" marker-end="url(#arrow)"{dash}/>'
    )


def note(svg: list[str], x: int, y: int, text: str, color: str = CYAN) -> None:
    svg.append(
        f'<text x="{x}" y="{y}" fill="{color}" font-size="18" font-weight="700" '
        f'font-family="Pretendard,Noto Sans KR,Apple SD Gothic Neo,sans-serif">{escape(text)}</text>'
    )


def save(name: str, svg: list[str]) -> None:
    (OUT / name).write_text("\n".join([*svg, "</svg>"]) + "\n", encoding="utf-8")


overview = base("전체 서비스 파이프라인", "게임은 브라우저에서 독립 실행 · 코치와 카페는 선택적 서버 연결", 760)
card(overview, 60, 160, 420, 210, "01 / CLIENT", "SUDO QUEST 화면",
     ["티켓 · NPC · 가상 터미널", "지식 탐색 · 카페 · 학습 기록"], CYAN)
card(overview, 590, 160, 420, 210, "02 / SANDBOX", "가상 명령 엔진",
     ["파서 → 가상 상태 조회·변경", "원인 선택 + 복구 조건 판정"], GREEN)
card(overview, 1120, 160, 420, 210, "03 / LEARNING", "리포트와 진행 기록",
     ["조사 출력 · 회고 · 점수", "브라우저 로컬 저장"], VIOLET)
arrow(overview, 480, 264, 575, 264)
arrow(overview, 1010, 264, 1105, 264)
overview.append('<path d="M58 410 H1542" stroke="#385165" stroke-width="2" stroke-dasharray="9 8"/>')
note(overview, 62, 437, "선택적 API 경계 / 숨겨진 정답·전체 가상 상태는 전송하지 않음", AMBER)
card(overview, 60, 467, 420, 210, "04 / PUBLIC INPUT", "공개 관찰만 선별",
     ["질문 · 티켓 · 연 힌트", "실행한 명령과 출력"], CYAN)
card(overview, 590, 467, 420, 210, "05 / API", "FastAPI 작업 처리",
     ["202 응답 + 상태 폴링", "코치 · 지식 검색 · 게시판"], AMBER)
card(overview, 1120, 467, 420, 210, "06 / DATA", "근거와 커뮤니티",
     ["Chroma: 항목 + 문서 청크", "SQLite: 게시글 · 댓글"], PINK)
arrow(overview, 270, 370, 270, 452, True)
arrow(overview, 480, 570, 575, 570)
arrow(overview, 1010, 570, 1105, 570)
save("overview.svg", overview)

cli = base("가상 CLI 실행 파이프라인", "실제 셸·실제 파일·실제 서버 명령을 호출하지 않음", 850)
cli_top = [
    ("01 / BOOT", "시나리오 시작", ["정상 호스트 프리셋 생성", "장애 함수를 순서대로 적용"], CYAN),
    ("02 / SESSION", "가상 서버 상태", ["파일 · 디스크 · 서비스 · 로그", "프로세스 · 네트워크 등 보관"], GREEN),
    ("03 / INPUT", "터미널 한 줄", ["예: df -h", "사용자 입력을 세션에 전달"], VIOLET),
    ("04 / PARSE", "문법·허용 명령", ["파이프 · 따옴표 · sudo 해석", "시나리오 명령 목록 확인"], AMBER),
]
cli_bottom = [
    ("08 / RESULT", "클리어 리포트", ["원인 확인 + 복구 조건 충족", "명령 기록 · 회고 · 점수"], PINK),
    ("07 / SESSION", "결과와 판정", ["stdout · stderr · exitCode 기록", "새 상태에서 resolution 검사"], VIOLET),
    ("06 / EXECUTE", "명령 구현과 계산", ["df: 파일 크기로 사용량 계산", "systemctl: 시작 조건 확인"], GREEN),
    ("05 / CLONE", "상태 복사", ["structuredClone(state)", "복사본만 조회·변경"], CYAN),
]
for i, item in enumerate(cli_top):
    card(cli, 60+i*390, 160, 340, 215, *item)
for i, item in enumerate(cli_bottom):
    card(cli, 60+i*390, 485, 340, 215, *item)
for i in range(3):
    arrow(cli, 400+i*390, 267, 440+i*390, 267)
    arrow(cli, 450+i*390, 592, 410+i*390, 592)
arrow(cli, 1400, 375, 1400, 470)
cli.append('<rect x="60" y="748" width="1480" height="55" rx="12" fill="#0e2630" stroke="#2c9daa"/>')
note(cli, 85, 782, "예시: 거대 로그 파일 정리 → df 사용량 감소 → nginx 재시작 가능 → 가상 상태로 복구 판정", CYAN)
save("virtual-cli.svg", cli)

index = base("RAG 데이터 준비·색인 파이프라인", "질문 전에 실행 · 질문 중 선택 문서는 필요한 경우에만 추가", 690)
index_items = [
    ("01 / CATALOG", "지식 항목", ["항목 메타데이터", "고유 ID · 출처 정보"], CYAN),
    ("02 / SOURCE", "공식 문서", ["허용 URL · 이용 조건", "원문 절 추출 · 캐시"], AMBER),
    ("03 / CHUNK", "문서 조각", ["기본 1000자 / 겹침 200자", "항목·문서·본문 해시 ID"], VIOLET),
    ("04 / VECTOR", "임베딩", ["본문 해시별 벡터 캐시", "없는 텍스트만 외부 호출"], GREEN),
    ("05 / CHROMA", "두 컬렉션", ["knowledge_items", "reference_chunks"], PINK),
]
for i, item in enumerate(index_items):
    card(index, 45+i*315, 170, 280, 235, *item)
for i in range(4):
    arrow(index, 325+i*315, 286, 355+i*315, 286)
index.append('<rect x="45" y="460" width="1510" height="155" rx="20" fill="#142337" stroke="#355977" stroke-width="2"/>')
note(index, 80, 505, "INDEX GUARD / manifest", CYAN)
note(index, 80, 548, "공급자 · 모델 · 청크 설정 · 차원이 달라지면 기존 색인을 재사용하지 않음", GREEN)
note(index, 80, 584, "재실행 시 기본 ID가 모두 있으면 HTTP·임베딩 0회로 종료 / 질문 중 추가된 청크는 유지", "#a9bdcd")
save("rag-index.svg", index)

rag = base("RAG 질문·답변 파이프라인", "지식 질문은 선별·수집 / 게임 코치는 플레이어가 본 사실만 사용", 900)
rag_top = [
    ("01 / REQUEST", "질문 + 항목 선택", ["POST /api/chat → 202", "작업 상태를 화면에서 폴링"], CYAN),
    ("02 / SEARCH", "검색어 추출", ["프롬프트 1 → JSON 검색어", "형식 실패 시 대체 검색어"], VIOLET),
    ("03 / SELECT", "후보 문서 선별", ["허용 절 목록에서 후보 생성", "프롬프트 2 · 후보 ID 검사"], AMBER),
    ("04 / COLLECT", "필요한 문서 수집", ["항목 자체 문서 항상 포함", "미색인 절만 청킹·임베딩"], GREEN),
]
rag_bottom = [
    ("08 / UI", "근거 있는 답변", ["인용한 문서만 카드로 표시", "근거 부족 시 보류"], CYAN),
    ("07 / CHECK", "인용 번호 검증", ["본문 번호 ↔ 목록 대조", "실패 시 1회 재생성"], PINK),
    ("06 / GENERATE", "답변 생성", ["프롬프트 3 · 번호 붙은 근거", "근거 2건 미만이면 생성 생략"], VIOLET),
    ("05 / RETRIEVE", "범위 제한 검색", ["항목 메타데이터 1건 고정", "선택 문서 Top-k 4 · 중복 제거"], GREEN),
]
for i, item in enumerate(rag_top):
    card(rag, 60+i*390, 160, 340, 210, *item)
for i, item in enumerate(rag_bottom):
    card(rag, 60+i*390, 470, 340, 210, *item)
for i in range(3):
    arrow(rag, 400+i*390, 265, 440+i*390, 265)
    arrow(rag, 450+i*390, 575, 410+i*390, 575)
arrow(rag, 1400, 370, 1400, 455)
rag.append('<rect x="60" y="730" width="1480" height="105" rx="18" fill="#211b34" stroke="#a788e4" stroke-width="2"/>')
note(rag, 88, 774, "COACH / 별도 경로: 공개 티켓·연 힌트·최근 명령/출력 → 항목 검색 → retrieve → generate", VIOLET)
note(rag, 88, 810, "프롬프트 2·질문 중 문서 수집 없음 / [실습 기록 N]과 [근거 N]을 각각 검증 / 정답·전체 state 전송 없음", "#c4b8e9")
save("rag-answer.svg", rag)
