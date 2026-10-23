# 004. 인용 검증과 후보 ID 안에서만 문서 선별

- **상황:** 학습용 답변이 그럴듯하지만 근거 없는 말을 하면 틀린 지식을 가르치게 된다. 모델이 문서 URL을 지어내거나 허용하지 않은 사이트를 고르게 두면 수집 정책(robots·라이선스)도 깨진다.
- **결정:**
  1. 문서 선별: 프로그램이 허용 공식 페이지의 절 목록에서 후보를 만들고, 모델은 **그 후보 ID 중에서만** 최대 4개를 고른다. 후보 밖 ID가 오면 `invalid_document_selection`. 항목 자체 문서는 항상 넣는다.
  2. 답변: 모든 주장에 `[근거 N]`, 코치는 `[실습 기록 N]`도. 본문의 번호와 `cited_*_ids`가 같고 실제 근거 번호 안에 있어야 통과. 틀리면 형식 안내를 붙여 1번 다시 묻고, 그래도 틀리면 답을 버린다(`citation_validation_failed`).
  3. 근거가 2개 미만이면 생성하지 않고 "문서에서 확인되지 않습니다"로 보류.
- **버린 대안:** (1) 인용 표시만 하고 검증 안 함 — 존재하지 않는 근거 번호가 그대로 나간다. (2) 모델이 검색어로 웹 검색 — 출처 통제 불가.
- **결과:** 08번 비교에서 RAG 답은 8/8 근거 연결, 문서 밖 질문은 보류. 평가 v2 결과는 22번 문서 3절. 대가: 인용 가능한 범위로만 답해 문서에 있는 조치를 빠뜨리는 경우가 있고(08번 Q2·Q3), 검증 실패 시 답을 아예 못 받는다.
- **근거:** `backend/app/rag.py`(`validate_answer`, generate), `backend/app/discovery.py`(`finalize_selection`), `test_rag.test_invalid_and_unused_citations`, `test_resilience.test_wrong_citations_twice_drop_the_answer`, `test_resilience.test_too_little_evidence_abstains_without_answer_call`.
