# InfraCoach 개발 환경

기존 React/TypeScript 가상 게임을 유지하고 FastAPI 서버를 추가한다. 복구 판정은 기존 엔진이 담당한다. 지식 항목 100건(curl 40·Linux errno 40·AWS ALB 20)을 색인하고, `/api/items`, `POST /api/chat`(질문 중 외부 후보 검색·수집 포함), `POST /api/items/search`(조건 탐색), `POST /api/coach`(실습 코치), `/api/jobs/{id}`(진행 상태)를 제공한다. 전체 구조와 실행 순서는 루트 README와 `docs/submission/`을 본다.

## 설치 (Windows PowerShell)

저장소 루트에서 실행한다. 확인 환경: Node 24.18.0, npm 11.16.0, Python 3.11.9.

```powershell
npm ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -X utf8 -m pip install -r backend/requirements.lock.txt
Copy-Item backend/.env.example backend/.env
```

`.env`가 이미 있으면 복사 단계를 생략한다. 가상환경 활성화 없이 실행해 PowerShell 실행 정책 변경이 필요 없다. 과제 PDF 5~6쪽 직접 의존성은 `requirements.txt`, 이 Windows 환경에서 설치한 전이 의존성까지의 고정본은 `requirements.lock.txt`다. 다른 OS는 `requirements.txt`로 설치 후 `pip check`를 실행하고 별도 검증한다. Streamlit은 과제 지정 의존성으로 설치하되 서비스 UI는 확정된 React를 사용한다.

## 서버와 게임 실행

터미널 A, 저장소 루트:

```powershell
Set-Location backend
.venv/Scripts/python.exe -X utf8 -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

터미널 B, 저장소 루트:

```powershell
npm run dev
```

게임: http://127.0.0.1:5173/ · API 문서: http://127.0.0.1:8000/docs

Vite는 `/api`를 8000번 서버로 프록시한다. 화면 상단에서 서버 연결·설정 여부·색인 건수를 확인한다. 서버를 끄더라도 게임은 계속 동작한다. 프로세스 종료는 각 터미널에서 Ctrl+C. 포트가 사용 중이면 기존 프로세스를 확인하며 임의 종료하지 않는다.

프론트 루트 `.env.example`은 선택 설정 `BACKEND_PROXY_TARGET`만 가진다. `VITE_*` 변수 및 브라우저 코드에 키를 넣지 않는다. 프로덕션 빌드와 `vite preview`는 개발 프록시를 사용하지 않는다. 배포할 때 `/api` 리버스 프록시와 Python 서버를 별도로 준비한다.

## GMS 연결

사용자가 제공한 GMS 안내 기준:

- 생성 모델: `gpt-6.1-sol`
- 생성 요청: `POST https://gms.ssafy.io/gmsapi/api.openai.com/v1/responses`
- `LLM_BASE_URL`은 `/v1/`까지 지정한다. SDK가 `responses`를 붙인다.
- `backend/.env`의 `GMS_KEY`에 본인 키를 입력한다. 설정 존재와 실제 연결 성공은 별개다.
- 임베딩 모델: `text-embedding-3-large`. `EMBEDDING_BASE_URL=https://gms.ssafy.io/gmsapi/api.openai.com/v1/`이며 SDK가 `embeddings`를 붙인다. 2026-10-21 실제 1건 호출 성공, 3,072차원 확인. 별도 dimensions 지정이나 추가 정규화는 하지 않았다.
- 생성과 임베딩은 독립 설정이다. GMS 호스트에만 `GMS_KEY`를 적용한다. 개인 공급자는 해당 URL과 `LLM_API_KEY` 또는 `EMBEDDING_API_KEY`를 명시한다. 실패 시 다른 공급자로 자동 전환하지 않는다.

`backend` 폴더에서 실행:

```powershell
.venv/Scripts/python.exe -X utf8 -m scripts.check_providers --only generation
.venv/Scripts/python.exe -X utf8 -m scripts.check_providers --only embedding
```

각 명령은 설정된 경우 짧은 실제 API 요청 1회를 보내며 크레딧을 사용한다. 키·응답 본문을 출력하지 않고 성공 여부, 모델, 문자 수 또는 임베딩 차원만 출력한다. 자동 재시도는 0회, 기본 시간 제한은 30초다. 실패/미설정은 종료 코드 1, 성공은 0이다. `generation_request_failed`/`embedding_request_failed`는 키·권한·URL·모델·네트워크를 점검한다. `incomplete_or_empty_generation`은 출력 한도 등 공급자 설정을 점검한다. 원문 예외에는 키가 포함될 수 있어 출력하지 않는다.

`/api/health`는 유료 호출을 하지 않으며 `configured`는 설정 존재만 뜻한다. `verified: false`는 이 상태 API가 실제 연결 성공을 보증하지 않는다는 뜻이다. 성공 증빙은 CLI 실행 결과로 기록한다.

호출 형식 참고: [OpenAI Responses](https://developers.openai.com/api/reference/python/resources/responses/methods/create), [Embeddings](https://developers.openai.com/api/reference/python/resources/embeddings/methods/create). GMS 모델 가용성은 GMS 안내 및 실제 호출로 별도 확인한다.

## 지식 카탈로그 (100건)

`catalog/`에 도메인 데이터가 있다. `sources.json`은 출처와 라이선스, `shortlist_100.json`은 후보 목록, `annotations_ko.json`은 한국어 주석(LLM 보조 작성, 검수 대기), `items.json`·`documents.json`은 생성물이다. 주석이나 후보를 바꾼 뒤에는 다음 순서로 실행한다(유료 API 호출 없음, 원문은 `data/corpus` 캐시 사용).

```powershell
.venv/Scripts/python.exe -X utf8 -m scripts.build_catalog
.venv/Scripts/python.exe -X utf8 -m scripts.validate_catalog
```

질문 중 외부 후보 검색(F2004)은 `catalog/section_catalog.json`(허용한 공식 페이지 8개의 절 669개)에서 키워드로 후보를 찾고, 선별 프롬프트로 고른 문서 중 아직 색인되지 않은 것만 수집·색인한다. 출처 페이지나 추출 규칙을 바꾸면 다시 만든다.

```powershell
.venv/Scripts/python.exe -X utf8 -m scripts.build_section_catalog
```

카탈로그가 바뀌면 색인 내용도 바뀐다. 기존 Chroma 경로는 재사용하지 않고 새 `CHROMA_PATH`로 다시 색인한다.

## 데이터·그래프

Chroma는 기본 `backend/data/chroma`에 저장한다. `knowledge_items`, `reference_chunks`를 자동 생성하고 기본 임베딩 모델을 자동 다운로드하지 않는다. `.venv/Scripts/python.exe -X utf8 -m scripts.prepare_corpus`로 공식 문서를 수집·색인한다(재실행 시 캐시로 HTTP·임베딩 0회). 테스트의 임시 벡터는 제품 색인에 들어가지 않는다.

`app/graphs.py`는 `START → retrieve → generate → END` 구조이며 `app/rag.py`가 실제 검색·생성 함수를 연결한다. 선택 항목 메타데이터는 항상 근거 1번, 인용 번호는 검증 후 실제 인용 근거만 반환한다. 임베딩 설정·청킹 값은 `data/chroma/manifest.json`에 기록되고 바뀌면 재색인을 요구한다.

## 검증

저장소 루트:

```powershell
npm test
npm run typecheck
npm run build
Set-Location backend
.venv/Scripts/python.exe -X utf8 -m unittest discover -s tests -v
.venv/Scripts/python.exe -m pip check
```

API 키 없는 서버 기동, 두 컬렉션 분리·동일 ID upsert·재연결, 그래프 실행 순서, 공급자 요청 형식·키 분리·오류 비노출을 검증한다. 공급자 단위 테스트는 모의 응답이며 실제 GMS 연결 증빙으로 사용하지 않는다.

## 배포 ZIP 검토

`교육생배포용.zip`의 `streamlit_lab/step7_skeleton.py`를 구조 참고로 읽었다. GMS 환경변수, 진행 상태, 답변과 출처를 함께 보관하고 실제 인용만 보여 주는 흐름을 활용할 수 있다. 수집 함수는 가짜 문서를 반환하며 Chroma/LangGraph/임베딩 구현은 없다. 단일 `messages` 목록은 항목별로 분리해야 한다. `step8_wiki_api.py`는 위키백과 전용이므로 공식 인프라 문서 수집기에 그대로 쓰지 않는다. ZIP 원본은 저장소에 복사하거나 실행하지 않았다.
