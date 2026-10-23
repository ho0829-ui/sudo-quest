# 005. 코치에는 플레이어가 본 것만 보낸다

- **상황:** 실습 중 AI 코치가 정답(원인 ID·모범 풀이·숨은 상태)을 알면 정답을 흘리게 되고, 사고 과정을 훈련한다는 게임의 목적이 무너진다.
- **결정:** 요청은 두 겹으로 막는다.
  1. 프론트 `buildCoachRequest`는 티켓, **연** 힌트, 플레이어가 직접 친 명령과 출력, 쓸 수 있는 명령 목록만 만든다(`faults`·`rootCause`·`solutionPath`·`state`·포스트모템·학습 목표·안 연 힌트는 넣지 않음).
  2. 서버 `CoachRequest`는 `extra="forbid"`라 그런 필드가 오면 422로 거부하고 값을 되돌려 보내지 않는다.
  항목을 고르지 않았으면 숨은 시나리오-항목 연결을 쓰지 않고, 질문·관찰에서 나온 검색어로 항목을 고른다.
- **버린 대안:** 시나리오 ID나 정답 항목을 코치에 알려 더 정확하게 답하게 하기 — 정확도는 오르지만 정답 유출과 같다.
- **결과:** 코치는 "관찰 사실 → 가설 → 다음 점검"만 말할 수 있다. 대가: 항목 자동 선택이 빗나가면 덜 관련된 문서로 답한다(평가 v2 코치 질문 Hit@3, 22번 문서 3절).
- **근거:** `src/api/coach.ts`, `backend/app/contracts.py`(`CoachRequest`), `backend/app/coach.py`, `test_coach.test_private_fields_rejected_without_echo`, 프론트 `tests/coach.test.ts`.
