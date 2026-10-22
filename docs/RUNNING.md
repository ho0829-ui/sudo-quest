# 실행하기

README에서 옮긴 자세한 실행 안내입니다. 게임만 해 볼 때는 1절, AI 코치·지식 탐색·게시판까지 쓸 때는 2절을 보세요.
백엔드 설정의 세부(GMS 연결, 카탈로그, 게시판)는 [backend/README.md](../backend/README.md)에 있습니다.

## 1. 게임만 (서버·키 필요 없음)

```bash
npm ci
npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 엽니다. 진행 기록은 이 브라우저의 localStorage에만 저장됩니다. Python 서버가 없으면 AI 코치·게시판은 "오프라인"으로 표시되고 게임은 그대로 동작합니다.

```bash
npm test             # Vitest
npm run typecheck    # 타입 검사
npm run build        # 배포용 빌드(dist/)
```

## 2. AI 코치·지식 탐색·게시판까지

확인 환경: macOS(Python 3.11, Node 24)와 Windows 11(Python 3.11.9, Node 24.18). 아래는 macOS 기준이고, Windows는 `.venv/bin/python`을 `.venv/Scripts/python.exe`로 바꿉니다.

```bash
# 1) 설치
npm ci
npm run setup:env      # .env와 backend/.env 생성. 기존 파일은 덮어쓰지 않음
python3.11 -m venv backend/.venv
backend/.venv/bin/python -X utf8 -m pip install -r backend/requirements.lock.txt
```

2) `backend/.env`의 `GMS_KEY=`에 본인 키를 넣습니다. **키는 이 파일에만** 두고 코드·문서·브라우저(`VITE_*`)에는 넣지 않습니다(`.env`는 Git 제외). 루트 `.env`는 `BACKEND_PROXY_TARGET`(기본 `http://127.0.0.1:8000`)만 씁니다. 기본 모델은 생성 `gpt-6.1-sol`, 임베딩 `gemini-embedding-2`이고, 다른 공급자는 `LLM_*`·`EMBEDDING_*` 변수로 바꿉니다.

```bash
# 3) 데이터 준비 (backend 폴더에서)
cd backend
.venv/bin/python -X utf8 -m scripts.check_providers     # 키·모델 연결 확인 (짧은 유료 호출 2회)
.venv/bin/python -X utf8 -m scripts.validate_catalog    # 131개 항목의 원문 절 확인 (유료 호출 없음)
.venv/bin/python -X utf8 -m scripts.prepare_corpus      # 공식 문서 수집·임베딩·색인 (첫 실행만 유료)
.venv/bin/python -X utf8 -m scripts.seed_community      # 게시판 예시 글 (선택, --remove로 제거)

# 4) API 서버 (터미널 A, backend 폴더)
.venv/bin/python -X utf8 -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000

# 5) 화면 (터미널 B, 저장소 루트)
npm run dev
```

상단바의 **AI 코치 배지**가 초록색 "RAG 준비됨"이면 준비가 끝난 것입니다. 배지를 누르면 서버 상태와, 키·색인이 없을 때의 해결 방법이 보입니다.

- 카탈로그(`backend/catalog/`)는 저장소에 들어 있습니다. 출처 페이지나 주석을 바꿨을 때만 `scripts.build_catalog`·`scripts.build_section_catalog`를 다시 실행합니다.
- 청크·임베딩 설정을 바꾸면 기존 색인을 쓰지 않습니다(ADR 006). `.env`의 `CHROMA_PATH`를 새 경로로 바꾸고 `prepare_corpus`를 다시 실행합니다.
- 백엔드 테스트: `cd backend && .venv/bin/python -X utf8 -m unittest discover -s tests`
- RAG 평가: `.venv/bin/python -X utf8 -m scripts.evaluate_v2 retrieval`(무료에 가까움) / `answers`(유료) — [22번 문서](infra-coach/22_RAG_근거_보강.md)
- 매번 같은 순서로 검사하려면 [정기 검증 체크리스트](infra-coach/23_정기_검증_체크리스트.md)를 따릅니다.

## 3. 시연 GIF·화면 사진 다시 만들기

```bash
# 개발 서버(5173)와 API(8000)를 켠 상태에서
node tools/demo/capture.mjs                     # main·tutorial·coach·stills (coach는 유료 호출 1회)
backend/.venv/bin/python tools/demo/make_gif.py  # tmp/demo 프레임 → docs/assets/demo/*.gif
```

설치된 Chrome을 빈 임시 프로필로 띄워 조작합니다(사용자 프로필·저장소와 무관). 다른 위치의 Chrome은 `CHROME_PATH`로 지정합니다.

## 4. 배포 메모

`.github/workflows/deploy.yml`은 `main` 브랜치 push에서만 GitHub Pages로 배포합니다. 정적 배포본에서는 게임만 동작하고 AI 코치·게시판은 백엔드 주소가 따로 필요합니다(계획: [19번 문서](infra-coach/19_로그인_튜토리얼_배포_계획.md)).
