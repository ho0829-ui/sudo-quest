# 001. 무거운 요청은 202 + 작업 폴링

- **상황:** 지식 질문·코치·조건 탐색은 LLM을 2~4번 부르고 공식 문서를 새로 수집할 수도 있어 20초 넘게 걸린다(22번 문서 지연 표). 한 HTTP 요청으로 기다리게 하면 브라우저·프록시 시간 제한에 걸리고, 사용자는 무엇을 하는지 모른다.
- **결정:** `POST /api/chat|coach|items/search`는 바로 `202 {job_id}`를 돌려주고, 작업은 스레드 2개짜리 풀에서 돈다. 프론트는 `GET /api/jobs/{id}`로 상태와 진행 단계(검색어 → 선별 → 수집 → retrieve → generate)를 받아 보여 준다.
- **버린 대안:** (1) 동기 요청 — 시간 제한·진행 표시 없음. (2) SSE·WebSocket 스트리밍 — 답을 인용 검증한 뒤에만 보여 줘야 해서(004) 토큰 스트리밍의 이점이 작고, 정적 배포 + 단일 백엔드 구성에 비해 복잡하다. (3) 외부 큐(Redis·Celery) — 의존성·운영 부담에 비해 동시 사용자가 적다.
- **결과:** 진행 단계가 보이고 오류는 정해진 안전 문장으로 끝난다. 대가: 작업은 메모리에만 있어 서버를 재시작하면 사라지고(10분 보관·최대 32개), 동시에 2개를 넘으면 429(`busy`)로 거절한다. 여러 서버로 늘리려면 저장소가 필요하다.
- **근거:** `backend/app/jobs.py`, `backend/app/main.py`, `test_source_faults.test_job_queue_refuses_third_running_job`, `test_rag.test_empty_index_job_reports_failure`.
