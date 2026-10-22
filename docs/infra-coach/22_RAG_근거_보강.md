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
