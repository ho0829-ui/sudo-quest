# 22. RAG 근거 보강 — 실패 처리 · 응답 지연 · 평가 v2 (2026-10-23, Mac, Claude)

20번 정리 4단계(D1~D3). 이 문서는 "무엇을 측정했고 어떻게 실패를 다루는지"를 한곳에 모은다.
설계 결정의 이유는 `adr/`, 정기 검증 순서는 `23_정기_검증_체크리스트.md`에 있다.

## 1. 실패 처리 표 (D3)

사용자에게는 정해진 안전한 문장만 보낸다(`backend/app/jobs.py` `SAFE_ERRORS`). 서버 로그에는 예외 종류와 HTTP 상태만 남기고 키·본문은 남기지 않는다.

**재시도 정책(4-a에서 추가):** 생성·임베딩 요청이 **5xx·시간 초과·연결 끊김**이면 1초 쉬고 **1회만** 다시 보낸다(`providers.with_retry`). 4xx(키·요청 오류)와 형식이 틀린 응답은 다시 보내도 같으므로 바로 실패한다. 생성은 `store=False`라 같은 요청을 다시 보내도 부작용이 없다. 공식 문서 수집은 사이트 예절(robots·호출 제한)을 지키려고 자동 재시도하지 않는다.

| 오류 코드 | 원인 | 사용자에게 보이는 문장(요지) | 재시도 | 검사하는 테스트 |
|---|---|---|---|---|
| `index_not_ready` | 색인을 만들지 않음 | 색인이 없다, `prepare_corpus` 실행 | 안 함(사용자 조치) | `test_rag.test_empty_index_job_reports_failure` |
| `index_configuration_changed` | 임베딩·청킹 설정이 색인과 다름 | 새 경로에 재색인 | 안 함 | `test_rag.test_index_idempotence_configuration_and_shared_documents` |
| `provider_not_configured` | 키 없음 | `.env`의 키 확인 | 안 함(모델 호출 전에 멈춤) | `test_source_faults.MissingKeyTests` |
| `generation_request_failed` | 생성 API 5xx·시간 초과·연결 실패, 또는 4xx | 키·모델·네트워크 확인 | **5xx·시간 초과·연결만 1회** | `test_resilience.RetryTests`(5xx→성공, 시간 초과→성공, 5xx 두 번→실패, 401→재시도 없음), `test_foundation.test_provider_error_is_redacted` |
| `embedding_request_failed` | 임베딩 API 실패 | 키·모델·네트워크 확인 | **5xx·시간 초과·연결만 1회** | `test_resilience.RetryTests.test_gemini_embedding_retry_rules`, `test_gemini_embedding.test_http_and_network_errors_hide_details` |
| `invalid_embedding_response` | 벡터 개수·차원·값이 이상함 | 응답 형식 검증 실패(4-a에서 안전 문장 추가, 전엔 일반 문장) | 안 함 | `test_gemini_embedding.test_rejects_wrong_count_dimension_or_values` |
| `incomplete_or_empty_generation` | 모델 응답이 미완성·빈 문자열 | 잠시 후 다시 | 안 함 | `test_source_faults.test_incomplete_generation_is_not_retried` |
| `citation_validation_failed` | 답의 인용 번호가 근거와 안 맞음(또는 JSON 형식 오류) | 인용 검증 실패, 답을 표시하지 않음 | **형식 안내를 붙여 1회 다시 묻기** 후 버림 | `test_resilience.test_wrong_citations_twice_drop_the_answer` |
| `invalid_document_selection` | 문서 선별 결과가 후보 밖 | 선별 결과 검증 실패 | 안 함 | `test_discovery` |
| `explore_judgement_invalid` | 조건 탐색 판정 형식 오류 | 다시 시도 | 안 함 | `test_explore` |
| `source_section_missing` | 공식 문서에서 그 절이 사라짐 | 문서가 바뀌었을 수 있음 | 안 함 | `test_rag.test_missing_section_fails_closed` |
| `source_http_error` | 공식 문서 HTTP 오류 | 잠시 후 다시 | 안 함 | `test_source_faults.test_source_http_error` |
| `source_rate_limited_retry_later` | 공식 문서 429 | 호출 제한, 잠시 후 다시 | **안 함(명시적으로 재실행)** | `test_source_faults.test_rate_limit_is_not_retried` |
| `robots_disallow` | robots.txt가 수집 금지 | 수집 정책상 불가 | 안 함 | `test_source_faults.test_robots_disallow` |
| `busy`(HTTP 429) | 동시에 도는 작업이 2개 | 요청 거절 | 안 함 | `test_source_faults.test_job_queue_refuses_third_running_job` |
| 그 밖(`source_not_allowed`·`robots_unavailable` 등) | 예상 밖 | 일반 문장 "요청 처리에 실패했습니다" | 안 함 | — |

**실패가 아닌 대체 동작**

| 상황 | 동작 | 테스트 |
|---|---|---|
| 검색어 추출 응답 형식 오류 | 항목명 + 질문으로 검색하고 경고 한 줄 | `test_resilience.test_bad_search_terms_fall_back_with_warning` |
| 근거가 2개 미만(항목 요약뿐) | 답 생성 호출 없이 "문서에서 확인되지 않습니다"로 보류 | `test_resilience.test_too_little_evidence_abstains_without_answer_call` |
| 코치가 가상 터미널에 없는 명령을 제안 | 경고를 붙임 | `test_coach.test_unsupported_command_detected_unless_marked` |

## 2. 응답 지연 측정 방법 (D2)

- `/api/chat`·`/api/coach` 결과에 `timings`를 붙인다: `{"stages": {단계: 초}, "total": 초}`(`backend/app/timing.py` `StageClock`). 단계는 진행 표시와 같은 이름이다.
  - `prepare`(색인 확인·캐시 조회) → `search_terms` → `select_documents`(또는 `select_cache`) → `collect` → `retrieve`(질문 임베딩 + 검색) → `generate`(답 생성 + 인용 검증, 재시도 포함)
  - 캐시 적중이면 `prepare` + `cache`만 있다.
- 숫자만 남기고 질문·키·본문은 넣지 않는다. 이번 요청의 값이라 답변 캐시 파일에는 저장하지 않는다.
- 측정 결과는 3절(평가 v2)에 적는다.

## 3. 평가 v2 (D1·D2)

### 3-1. 방법

- 질문 24개(`backend/evaluation/rag_eval_v2.json`): 제품 6종(Linux·curl·AWS ALB·AWS·Docker·Kubernetes) × 3 = **문서 안 18**, **문서 밖 3**(보류해야 맞음), **코치 3**(실습 기록 기반).
- 정답 문서 절(`gold_doc_ids`)·핵심 사실(`expected_facts`)·근거에 있어야 할 원문 문구(`markers`)는 **실행 전에** 수집된 공식 문서 원문 절을 읽고 고정했다. 문구가 실제로 원문에 있는지는 작성할 때 스크립트로 확인했다.
- 코치 질문 3개의 요청 본문(`backend/evaluation/coach_requests_v2.json`)은 게임 엔진에서 실제 명령을 실행하고 프론트의 `buildCoachRequest`로 만들었다(정답 정보 없음 — ADR 005). 실습: kubernetes-crashloop(조회 3개), docker-port-allocated(4개), linux-too-many-files(2개).
- 스크립트: `backend/scripts/evaluate_v2.py`.
  - `retrieval`: 생성 호출 없이 질문 문장을 임베딩해 검색만 본다. (a) 서비스와 같은 범위(고른 항목 + 그 항목의 문서), (b) 범위 없이 전체 청크, (c) 코치처럼 `knowledge_items`에서 항목 3개 자동 선택.
  - `answers`: 서비스 함수(`respond`·`coach`)를 그대로 불러 답까지 만든다(질문 중 수집·LLM 선별 포함). 같은 세트를 두 번 돌려 두 번째는 캐시 적중 지연을 잰다.
- 설정: 색인 `data/chroma-gemini`(지식 131 / 청크 298), 임베딩 `gemini-embedding-2`, top_k 4, 청크 1000/200. 생성 모델은 비용 때문에 `gpt-6-luna`(제출 모델 `gpt-6.1-sol`과 다름 — 결과를 sol 성능으로 읽지 않는다).

### 3-2. 검색만 (질문 18개, 임베딩 호출 1회)

| 지표 | 값 | 뜻 |
|---|---|---|
| 항목 범위 Hit@4 | **18/18** | 서비스 범위에서 정답 절 청크가 상위 4개 안에 있다 |
| 항목 범위 MRR | **0.944** | C1·C2만 정답 절이 2위(1위는 같은 오류의 libcurl 절 — 내용이 거의 같다) |
| 근거 안 원문 문구 | **32/33** | W1의 "IP가 고정이 아니면" 문구는 긴 문서(5,800자)의 다른 청크라 상위 4개에 안 들어왔다 |
| 전체 청크 Hit@4 / Hit@10 | **18/18 / 18/18** | 항목을 고르지 않아도 정답 절이 상위에 온다 |
| 항목 자동 선택 Hit@3 | **18/18** | 코치처럼 항목을 모를 때도 정답 항목이 3개 안에 든다 |

- 한계: 항목 범위 검색은 후보 문서가 항목당 1~3개라 Hit@4가 높게 나오기 쉽다. 그래서 범위 없는 전체 검색과 항목 자동 선택을 함께 봤다. 질문 18개는 작은 표본이다.

### 3-3. 답변까지 (서비스 경로, 2026-10-23, `gpt-6-luna`)

결과 원본: `docs/infra-coach/evaluation/rag_eval_v2_answers.json`(1회차), `rag_eval_v2_answers_pass2.json`(2회차: 캐시 적중 + 1회차에 실패한 2문항 재실행).

| 지표 | 1회차 | 2회차 | 비고 |
|---|---|---|---|
| 답변 성공 | 22/24 | 23/24 | 실패는 모두 `citation_validation_failed`(인용 형식 2회 연속 오류 → 답을 버림) |
| 실패 문항 | A2·W1 | A2 | W1은 다시 하니 통과(간헐), A2(ALB 타깃 InService, 원문 3,500자)는 두 번 다 실패 |
| 정답 절을 선별(문서 안) | 16/16 | 17/17 | LLM 선별이 정답 절을 빠뜨린 적 없음(항목 자체 문서는 항상 포함 — ADR 004) |
| 정답 절을 인용(문서 안) | 16/16 | 17/17 | |
| 문서 안 질문에서 보류 | 0/16 | 0/17 | 답할 수 있는데 보류한 경우 없음 |
| 문서 밖 질문 보류(자동 판정) | 2/3 | 2/3 | O1은 "문서에서 … 계산 방법은 확인되지 않습니다"로 **실제로는 보류**했지만 문구가 갈라져 자동 판정에서 빠졌다 → 사람 기준 **3/3** |
| 코치 항목 자동 선택 Hit@3 | 3/3 | 3/3 | 코치 답 3개 모두 `[실습 기록 N]` 인용(3·4·2개), 지원 안 되는 명령 제안 0 |
| 공급자 일시 장애 | 503 1회 | — | **4-a의 재시도로 사용자 오류 없이 통과**(서버 로그에 "retrying once") |

**핵심 사실 채점** (채점: Claude, 기준: 실행 전에 고정한 `expected_facts`. **사람 검토 필요** — 아래 표본 5개를 Choi가 확인해 주세요.)

| 판정 | 문항 |
|---|---|
| 정확(핵심 사실 모두) | L1 · L2 · L3 · C2 · A1 · A3 · W2 · W3 · D1 · D3 · K1 · K3 (12) |
| 부분 | C1(옵션은 맞지만 "종료 코드 6 = 호스트 이름 해석 실패"를 안 말함) · C3(같은 유형, 60의 뜻 생략) · W1(2회차, "IP가 고정이 아니면 규칙에서 빠질 수 있다" 누락 — 검색에서도 그 청크가 안 들어옴) · D2("기본값 no" 누락) · K2("수명 전체 동안 실행" 누락) (5) |
| 오답 | 0 |
| 답 없음 | A2(인용 검증 실패) |
| 사람 검토 표본 | C1 · D2 · K3 · O1 · P2 |

- 문서 밖 주장: 검토한 답에서 근거 밖 사실을 단정한 경우는 찾지 못했다. K3의 "OOMKilled·종료 코드 137"은 원문 예시에 있다.

### 3-4. 응답 지연 (D2)

| 구분 | n | p50 | p95 | 평균 |
|---|---:|---:|---:|---:|
| 캐시 미적중(1회차, 성공한 22개) | 22 | 11.8초 | 15.1초 | 11.5초 |
| 캐시 적중(2회차) | 22 | 0.0초 | 0.0초 | 서버 처리 2ms 이하 |

| 단계(1회차 p50) | prepare | search_terms | select_documents | collect | retrieve | generate |
|---|---:|---:|---:|---:|---:|---:|
| 초 | 0.0 | 2.1 | **5.2** | 0.0 | 0.7 | 2.7 |

- 가장 오래 걸리는 단계는 **문서 선별(LLM)** 이다. 같은 항목·같은 검색어면 선별 결과를 캐시하므로(ADR 006) 반복 질문에서는 줄어든다. 수집 p50은 0초지만, 일부 질문에서는 선별된 새 절을 질문 중에 수집·색인했다(원문 청크 298 → 308개). 검색만 평가는 그 전(298개)에 돌렸다.
- 08번 비교(평균 23.2초)는 모델이 `gpt-6.1-sol`이라 직접 비교하지 않는다.

### 3-5. 비용과 한계

- 호출 수(파이프라인 구조로 센 추정 — 성공한 답 중 인용 재시도가 있었는지는 기록하지 않아 그만큼 더 많을 수 있다): 생성 약 77회(1회차 약 72 = 지식 질문 21 × 검색어·선별·답변 3 + 실패 2문항 추가 시도 2 + 코치 3 × 2 + 503 재시도 1, 2회차 재실행 약 5), 임베딩 27회(검색 평가 1 + 답변 평가의 질문 임베딩 26) + 질문 중 수집한 새 청크 10개의 임베딩(호출 수는 기록하지 않음). 토큰 수는 재지 않았다.
- 표본이 작다(문서 안 18, 문서 밖 3, 코치 3). 채점은 개발 도우미가 했다. 생성 모델이 제출용과 다르다.
- 발견한 개선 후보(아직 안 고침):
  1. 긴 원문 절(A2 3,500자, W1 5,800자)에서 인용 형식 실패가 몰렸다 → 근거 청크 수(top_k)나 답변 형식 안내를 바꿔 다시 재 볼 것.
  2. 오류 코드의 "뜻"을 묻지 않으면 답이 옵션만 말하는 경향(C1·C3) → ANSWER 프롬프트에 "질문에 나온 오류 코드의 뜻을 먼저 한 줄" 규칙을 검토.
  3. 보류 자동 판정은 문구 일치라 O1처럼 놓친다 → 평가 스크립트에서 "확인되지 않" + 인용 범위로 판정하도록 개선.
