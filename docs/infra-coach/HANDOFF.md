# InfraCoach 현재 인수인계

갱신: 2026-10-21 · 단계: 구현·검증·제출 문서 완료. 셀프 체크리스트·상호 점검·제출은 사용자 몫

## 최신 상태 — ALB 실습 fail-open 정합성 수정 (2026-10-21 18시대, 아래 기록보다 우선)

- 문제: 실습 `aws-alb-healthcheck`가 "모든 타깃 unhealthy → 503"을 전제로 했다. AWS 문서(target-group-health-checks)에 따르면 모든 활성 AZ의 모든 타깃이 헬스체크에 실패하면 ALB는 fail-open한다. 그래서 코치(공식 문서 근거)와 실습 설명이 반대되는 말을 할 수 있었다.
- 선택: 원인(헬스체크 경로 /healthz), 장애 주입, 모범 풀이, 복구 판정, ID는 유지하고 증상을 공식 동작으로 바꿨다(B안). 엔진에 타깃 등록 기능을 추가해야 하는 "등록 타깃 없음" 시나리오(A안)는 택하지 않았다.
- 시나리오 변경(`src/scenarios/aws-alb-healthcheck.ts`):
  - 제목 "헬스 알람이 울리는데 사이트는 열려요".
  - 티켓: HealthyHostCount=0 알람이 울리는데 사이트는 정상이다, 꺼도 되나?
  - 로그: HealthyHostCount=0, UnHealthyHostCount=1, Target 2XX 정상. ELB_503 로그는 제거했다.
  - 학습 목표, 오답 보기("오탐", "타깃 없음이면 503"), 힌트 3단계, 포스트모템(fail-open과 그 위험, 503의 공식 원인, 출처)을 새로 썼다.
- 엔진 변경:
  - 중지·종료 타깃의 unused 사유를 Target.NotInUse에서 Target.InvalidState로 바꿨다(공식 상태 표).
  - `requestInstance`: bastion→EC2 HTTP(80) 응답을 상태에서 계산한다. 인스턴스 중지나 보안그룹(소스 IP CIDR) 차단이면 timeout, 서빙 경로면 200, 아니면 404. 헬스체크와 같은 servedPaths를 쓴다.
  - curl: 값을 받는 옵션(--max-time 등)의 값을 URL로 읽던 버그를 고쳤고, `-i` 헤더+본문 출력과 응답 이유 문구(404 Not Found 등)를 추가했다.
- 검증:
  - vitest 197(새 테스트 4개: InvalidState, 실습 증상, curl 값 옵션, EC2 직접 요청), typecheck·build 통과.
  - 브라우저에서 처음부터 풀었다: /healthz 404, /health 200 → 경로 수정 → healthy → 오답 "오탐"의 해설에 fail-open → 정답 → 복구 완료(S, 910점). 포스트모템을 캡처했다(`docs/submission/evidence/T23_alb_failopen_postmortem.jpg`).
  - 같은 실습에서 코치 질문 1건(유료): 실습 기록 2건과 fail-open 근거를 인용하고 "사이트가 열린다는 것만으로 오탐이 아니니 알람을 끄지 말 것"이라고 답했다. 실습 설명과 일치한다.
  - 코치가 제안한 `curl -i --max-time 5 …`가 처음에 엔진 버그로 실패한 것을 계기로 위 curl 수정을 했다.
- 문서: 제출 문서(요구사항 5절, 설계 9·10절, 검증 T23·테스트 수), README 시나리오 표·한계·테스트 수를 갱신했다.
- 새로 발견(미수정): 13개 실습 모두 정답 보기가 첫 번째이고 CauseDialog가 순서를 섞지 않는다. TASKS에 추가했다.

## 최신 상태 — 제출 문서 정리 (2026-10-21 18시대, 아래 기록보다 우선)

- 위치 결정: 제출물은 `docs/submission/`(Git 커밋 대상)에 둔다. `docs/infra-coach/`는 작업 기록용이라 미추적으로 유지한다. 증빙 캡처 6장, 평가 JSON 4개, 비교 보고서 3개(07·08·09)를 `docs/submission/`으로 복사했다(링크 경로 수정).
- 새 문서:
  - `docs/submission/요구사항정의서.md`: 도메인 조건 근거, F2001~F2016, NF, 게임 연결 G-01/02, 한계.
  - `docs/submission/RAG_파이프라인_설계문서.md`: 컬렉션·ID·수집 흐름·병합·프롬프트 4개·설정값과 비교·근거 표시·코치 설계 이유·겪은 문제 10건·한계.
  - `docs/submission/검증결과.md`: 자동 테스트 재실행 결과, T01~T23(부분: T10·T15·T20·T21·T23), 제출 전 점검, 상호·셀프 미실시 명시.
  - 루트 `THIRD_PARTY_NOTICES.md`.
- README:
  - 루트 상단을 실제 기능·필수/심화 구분·실행 절차·출처·한계로 교체하고, 테스트 수를 193으로 고쳤다.
  - `backend/README.md` 상단의 "파일럿" 설명을 갱신했다.
  - 루트에서 `unittest -s backend/tests`는 import 오류가 나서 backend 폴더에서 실행하는 명령으로 고쳤다(실행 확인).
- 재측정(문서 작성 직전): vitest 193, typecheck·build 통과, 백엔드 37 OK, pip check OK, validate_catalog failures 0, prepare_corpus 캐시 적중(HTTP·임베딩 0).
- 키 검사: 실제 키 값 문자열로 추적 파일·dist·docs·README를 검사해 0건이었다(키 값은 출력하지 않음).
- 사용자가 해야 할 것: 공식 셀프 체크리스트(3일차 오후) 작성, 동료 상호 점검, 제출 zip 구성(`AI코어프로젝트2_[주제명]_지역_반_성명.zip`), lab.ssafy.com 업로드(외부 업로드는 사용자 승인 사항).
- 남은 기술 과제(선택): ALB 실습 fail-open 불일치 수정, 5xx 1회 재시도 결정, 개선 프롬프트를 새 질문으로 확인, 한국어 주석 사람 검수, 새 폴더에서 README대로 처음부터 재현.

## 이전 상태 — 답변 프롬프트 조치 누락 수정 (2026-10-21 17시대, 아래 기록보다 우선)

- `prompts.ANSWER`: "필요한 한계만 간결하게 설명한다"를 지우고 규칙을 넣었다. 대응을 묻는 질문이면 인용한 근거의 조치·확인 방법·설정 변경을 모두 [근거 N]과 함께 쓰고, 근거에 없는 조치는 덧붙이지 않는다. `rag.PROMPT_VERSION` discovery-2(답변 캐시 무효화).
- `scripts/compare_rag.py`에 `--rag-only --output` 옵션을 넣었다. RAG 없음 기준 답변은 재사용한다.
- 실측(8000 서버 재시작 후, `data/evaluation/f2015_results_v2.json`, 사본 `docs/infra-coach/evaluation/`):
  - RAG 8문항 모두 정확(v1 정확 6·부분 2). Q2·Q3는 문서의 조치를 모두 인용했다.
  - Q9는 보류를 유지했다. 문서에 없는 조치를 추가한 경우는 0건이다.
  - 평균 25.7초(문항별 8.8~42.5초). 새 수집은 없었다(이미 색인됨).
  - 보고서 08의 5절에 추가했다. 채점은 개발 도우미가 했으므로 사람 검토가 필요하다.
- 테스트: 백엔드 37개 OK(프롬프트 문자열만 바뀌어 기존 테스트 영향 없음).
- 비용: RAG 9문항 재실행(생성 약 27회, 임베딩 9회). 토큰은 측정하지 않았다.
- 다음 한 가지 작업: 제출 문서 정리(요구사항 정의서, RAG 설계문서, 루트 README, 검증 결과표). 남은 결정 항목: 5xx 1회 재시도 여부, 개선 프롬프트를 새 질문으로 확인하는 일.

## 이전 상태 — 청크 크기·Top-k 비교 (2026-10-21 17시대, 아래 기록보다 우선)

- `scripts/compare_settings.py`: 실험 색인 `data/chroma-exp-700/-1000/-1400`(서비스 `chroma-v2`와 분리). 질문 8개로 검색만 비교하고(핵심 원문 문구 15개 포함 여부), Top-k 2/4/6을 비교했다. `--generate`면 Q2·Q3·Q4 답변까지 만든다.
- 결과(실측, 보고서 `09_청크_TopK_비교.md`, 원본 `docs/infra-coach/evaluation/settings_comparison.json`):
  - 청크 수: 700→247, 1000→221, 1400→214(중복 200 고정). 핵심 문구: 13/12/13. 차이는 Q1 헬스체크 문서의 청크 경계 하나 때문이다.
  - Top-k(청크 1000): 2/4/6 → 핵심 문구 12/12/13, 근거 글자 5,711/9,886/11,666.
  - Q7·Q8의 두 번째 문구는 모든 설정에서 빠졌다(다른 항목 문서이며, F2004로 해결).
  - 생성: Q2·Q3·Q4는 k와 무관하게 근거 2건이었다. Q2·Q3의 조치 누락은 근거 청크 안에 조치 문장이 있는데도 생긴 것이라 **답변 프롬프트 문제**다.
  - 결정: 1000/200/k=4를 유지한다.
- 함께 고친 것: 벡터 캐시 폴더 키를 `embedding_identity`(공급자·모델·정규화)로 바꿨다. 이전에는 청크 설정까지 들어 있어 설정만 바꿔도 다시 임베딩했다. 기존 벡터 338개를 새 폴더로 복사했고 이전 폴더는 보존했다. 테스트 `VectorCacheTests`를 추가했고, 서비스 색인 재실행은 임베딩 0회였다.
- 비용: 새 청크 임베딩 76개(호출 11회), 질문 임베딩 1회, 생성 비교 6건.
- 검증: 백엔드 37개 OK.
- 다음 한 가지 작업: 제출 문서 정리(요구사항 정의서, RAG 파이프라인 설계문서, 루트 README 실행 방법, 검증 결과표 T-xxx). 그 전에 TASKS의 결정 항목(답변 프롬프트 조치 누락, 5xx 재시도) 처리 여부를 사용자에게 확인한다.

## 이전 상태 — F2015 RAG 전후 비교 (2026-10-21 17시대, 아래 기록보다 우선)

- 질문 9개(문서 안 8, 문서 밖 1)의 정답 기준을 실행 전에 원문으로 작성했다: `backend/evaluation/f2015_questions.json`(커밋 대상).
- 실행: `scripts/compare_rag.py`. RAG 없음은 같은 모델에 질문과 중립 지시만 보내고, RAG 있음은 8000 서버 `/api/chat`을 쓴다.
  - 결과 원본: `backend/data/evaluation/f2015_results.json`, 사본은 `docs/infra-coach/evaluation/`.
  - RAG 없음 Q2가 GMS 502로 실패해 1회 다시 실행했다(기록함).
- 결과(채점자: 개발 도우미, 사람 검토 필요):
  - 문서 안 8문항 정확성: RAG 없음 정확 7·부분 1(Q7 nr_open 누락), RAG 정확 6·부분 2(Q2·Q3 조치 생략). 오답은 양쪽 모두 0.
  - 근거 제시: RAG 없음 0/8, RAG 8/8.
  - Q9(문서 밖): RAG 없음은 수치를 단정했고, RAG는 보류했다.
  - 우리 문서로 확인할 수 없는 추가 주장: RAG 없음 5/8, RAG 0/8.
  - 응답 시간 평균: 11.9초 vs 23.2초.
  - Q5·Q7에서 F2004가 질문 중 문서(curl --fail·--fail-with-body, errno ENFILE)를 수집해 정확도에 기여했다.
- 결론(보고서 08): 이 모델·표본에서는 정확도 향상을 주장할 수 없다. 차이는 검증 가능성, 보류, 범위 준수이고, 대가는 지연 약 2배와 일부 조치 생략이다.
- 다음 한 가지 작업: 청크 크기(700/1000/1400)·Top-k(2/4/6) 설정 변경 비교(F2005/F2006 검증 항목, 과제 산출물 "값을 바꿨을 때의 차이"). 청크 변경은 새 CHROMA_PATH에 재색인이 필요하다(유료 임베딩 소량). 이어서 제출 문서(요구사항 정의서·RAG 설계문서·README) 정리.

## 이전 상태 — F2012 안내·F2009 격리 증빙 (2026-10-21 16:35~17:00, 아래 기록보다 우선)

- 변경:
  - BackendStatus: 누락된 환경변수 이름과 `backend/.env`·`GMS_KEY` 안내, 색인이 없거나 설정이 맞지 않을 때 `scripts.prepare_corpus` 명령을 안내한다. 문구 "파일럿"을 제거했다.
  - jobs 안내 문구: index_not_ready, provider_not_configured를 구체적으로 바꿨다.
  - 지식 답변에 "이번 질문에서 새로 수집·색인한 공식 문서" 제목을 표시한다(rag 결과 `collected_documents`).
  - 면책 문구를 보강했다(실제 운영 환경의 진단·복구 판단을 대신하지 않음).
  - `src/ui/chatHistory.ts`(`historyFor`)로 분리하고 vitest 3개를 추가했다.
  - providers: 실패 시 서버 로그 `infracoach.providers`에 예외 종류와 HTTP 상태만 남긴다(키·메시지 제외, test_foundation에서 확인).
  - `.claude/launch.json`에 오류 상태 재현용 `api-empty-nokey`, `api-index-nokey`, `dev-5174-to-8001`을 추가했다.
- 증빙: `docs/infra-coach/07_화면증빙_F2009_F2012.md`, `docs/infra-coach/evidence/` 캡처 6장. 표의 모든 항목이 통과이며, 진행 단계는 일부만 화면에 포착됐다.
- F2009 실측: 실제 `/api/chat` 요청 본문을 확인했다.
  - 다른 항목으로 바꾸면 history가 0개다.
  - 같은 항목으로 돌아오면 그 항목의 완료된 대화만 들어간다(실패한 턴은 제외).
  - 화면에서도 항목별 대화가 유지·분리됐다.
- 관찰된 외부 오류: GMS 생성 1회 실패(원인 미기록), 임베딩 `InternalServerError status=502` 1회. 다시 시도하자 둘 다 성공했다. 자동 재시도 0회 정책은 유지했고, 5xx 1회 재시도 여부는 TASKS에 결정 항목으로 남겼다.
- 검증: 백엔드 36개 OK, vitest 193, typecheck, build 통과.
- 비용: 이번 작업에서 새 질문 4건(그중 실패 2건)과 연결 점검 1회를 호출했다. 토큰 사용량은 측정하지 않았다.
- 실행 중 프로세스: 8000(api, 미리보기 관리), 5173(기존 Vite). 임시 8001·5174는 종료했다.
- 다음 한 가지 작업: F2015 RAG 전후 비교(질문 5개 이상, 같은 모델로 문서 제공 여부만 바꿈). 이어서 청크 크기·Top-k 설정 비교(F2005/F2006 검증 항목)와 제출 문서 정리.

## 이전 상태 — F2010 공개 실습 기록 기반 게임 코치 (2026-10-21 16:05~16:35, 아래 기록보다 우선)

- 구현:
  - 프론트 `src/api/coach.ts`의 `buildCoachRequest`: Session에서 허용 필드만 골라 새 객체를 만든다.
    - 보내는 것: 티켓, 연 힌트만, 직접 입력한 명령의 stdout·stderr·exit_code(최근 30개, 생략 개수 표시), 사용 가능 명령 목록, 무작위 session_id(crypto.randomUUID), 선택한 주제 항목(선택 사항), 최근 대화 3회.
    - 긴 출력은 앞 55%와 뒤를 남기고 "[중간 N자 생략]"으로 표시한다.
    - 시나리오 ID·제목·학습 목표·정답·보기·풀이·state·포스트모템은 넣지 않는다.
  - React `CoachPanel`(실습 사이드바, 힌트 아래): 주제 선택(기본은 자동), 진행 단계, 답변, 인용한 실습 기록, 문서 근거를 보여 준다. 실습 판마다 대화를 새로 시작한다.
  - 서버 `CoachRequest`: extra=forbid라 faults·answerId·solutionPath·state·postmortem·scenario_id는 422로 거부하고 입력값을 응답에 되돌려 보내지 않는다. 길이·개수 상한이 있고, 없는 item_id는 404.
  - `app/coach.py`: 검색어(프롬프트 1) → retrieve(선택 항목, 또는 질문+검색어 임베딩으로 knowledge_items 상위 3개와 그 청크 Top-k) → generate(`prompts.COACH`, 프롬프트 3의 훈련 모드).
    - 숨겨진 시나리오-항목 연결은 쓰지 않는다.
    - [근거 N]과 [실습 기록 N] 번호를 모두 검증하고, 실패하면 1회 다시 요청한 뒤 citation_validation_failed로 처리한다.
    - 제안에 지원하지 않는 명령이 있는데 "실제 환경 참고" 표시가 없으면 경고한다.
    - 결과 캐시는 `data/coach`, PROMPT_VERSION=coach-1.
  - API `POST /api/coach` → job_id.
- 테스트:
  - vitest `tests/coach.test.ts` 15개: 13개 시나리오 각각에서 힌트 1개를 열고 명령 1개를 실행한 뒤 요청을 만들어, 허용 키만 있는지, 열지 않은 힌트·입력하지 않은 풀이 명령·정답 ID·보기·whyWrong·학습 목표·포스트모템·시나리오 ID/제목이 없는지 검사한다. 시나리오마다 검사할 비공개 문자열이 6개 이상인지도 확인한다. 긴 출력 앞뒤 보존과 30개 제한도 검사한다.
  - 백엔드 test_coach 5개: 비공개 필드 거부, 관찰 번호, 두 종류 인용 검증, 지원하지 않는 명령 감지, 파이프라인(retrieve→generate·자동 항목 3개·캐시).
  - 전체: 백엔드 36개 OK, vitest 190, typecheck, build 통과.
- 실측(브라우저, 디스크 가득 참 실습, 힌트 0개): `systemctl status nginx`, `journalctl -u nginx -n 20`, `df -h`를 실행한 뒤 "지금까지 본 것으로 다음에 무엇을 확인하면 좋을까요?"라고 물었다.
  - 검색어: nginx open() No space left on device 등. 자동 항목: ENOSPC, EMFILE, ENFILE.
  - 답변이 "확인된 사실 / 가설 / 다음 확인"으로 나뉘었다. 인용은 실습 기록 3건, 근거 1건(errno(3) ENOSPC).
  - 원인을 단정하지 않았다(access.log가 원인이라고 단정할 수 없다고 명시). 다음 점검으로 `du -xhd1 /`, `/var`, `/var/log` 순서를 제시했다.
  - 제안한 `du -xhd1 /`는 가상 터미널에서 실행됐다(/var/log/app 5.9G 확인). 엔진의 du는 깊이 옵션을 무시하고 전체를 출력한다.
  - 소요 시간은 따로 재지 않았다(UI 대기 60초 안에 완료).
- 한계:
  - 실측은 디스크 실습 1개, 힌트 0단계뿐이다. 힌트 단계별 차이와 네트워크·ALB 실습은 아직 보지 않았다.
  - 명령 지원 검사는 명령 이름만 본다(옵션 지원 여부는 검사하지 않음). 답변 본문 속 명령은 검사하지 않는다.
  - 브라우저 게임 코드에 정답 데이터가 들어 있는 구조는 그대로다. 목표는 코치(서버·LLM)로 정답이 전달되지 않게 하는 것이다(02 명세 §3.3).
- 다음 한 가지 작업: F2012 상태·오류 안내 화면 증빙(키 누락·색인 0건·검색 결과 없음)과 F2009 항목별 대화 격리 확인. 이어서 F2015 RAG 전후 비교(질문 5개 이상).

## 이전 상태 — F2011 조건 기반 항목 탐색 (2026-10-21 15:40~16:05, 아래 기록보다 우선)

- 구현:
  - `app/explore.py`가 하는 일:
    - 명시 조건 추출: 제품(curl/Linux/AWS ALB)과 카탈로그에 실제로 있는 오류 코드만 뽑는다. 한글 조사가 붙어도 인식하도록 영문·숫자 경계를 쓴다.
    - 후보: 코드 조건이 있으면 그 코드를 가진 항목을 그대로 쓴다(임베딩 없음). 없으면 knowledge_items 의미 검색 20건에 제품 where 필터를 건다.
    - 판정: 프롬프트 4(`prompts.EXPLORE`)가 공개 메타데이터만 보고 판정한다. 후보 밖 ID는 거부하고, 판정 뒤에도 명시 조건을 어긴 항목은 제외해 `rejected_by_filter`에 기록한다.
    - 결과 캐시(`data/explore`, 키는 질의+corpus_hash+모델+PROMPT_VERSION=explore-2).
  - API `POST /api/items/search` {query}는 202 job_id를 돌려준다. 결과는 기존 `/api/jobs/{id}`로 받는다. 추가 필드는 422로 거부하며 입력값을 응답에 되돌려 보내지 않는다.
  - React `ConditionSearch.tsx`: 진행 단계, 결과 카드(제품·작성자 분류·이유), 적용한 필터, 판정 불가 조건, 결과 없음 안내를 표시한다. 카드를 누르면 그 항목 대화가 열린다.
  - 프롬프트는 이제 4개다(검색어·선별·답변·조건 판정). 과제의 세 프롬프트에 탐색 판정용 1개를 더했다.
- 데이터 수정: ALB 항목 `error_codes`가 절 이름(`http-503-issues`)으로 들어가 있던 오류를 고쳤다. 지금은 HTTP 상태 코드(503 등)만 넣고, 상태 코드가 없는 절은 빈 배열이다. corpus_hash가 바뀌어 새 경로 `data/chroma-v2`에 다시 색인했다(임베딩 호출 2회, 새 텍스트 20개, HTTP 0. 재실행 0회·건수 100/221 불변). `.env` CHROMA_PATH=data/chroma-v2. 이전 경로 chroma-100·chroma는 보존했다. chroma-100에서 질문 중 수집했던 EDQUOT 청크는 v2에는 없고, 다음 질문 때 다시 수집된다(벡터 캐시가 있어 임베딩 비용 없음).
- 실측(8000 서버 API, 각 조건 생성 1회 + 코드 조건이 없으면 임베딩 1회):

  | 조건 | 적용 필터 | 결과 | 조건 위반 |
  |---|---|---|---|
  | curl에서 TLS 인증서 검증과 관련된 오류 | curl | curl-60, 91, 77, 90, 82 (10.8초) | 0 |
  | 리눅스에서 디스크 공간이나 할당량이 부족할 때 나는 오류 | Linux | ENOSPC, EDQUOT (5.5초) | 0 |
  | ALB에서 타깃과의 연결 문제로 생기는 5xx 오류 중 초급자용 | AWS ALB | 502, 504 (9.1초). "초급자용"은 판정 불가로 표시 | 0 |
  | HTTP 503 오류 | 코드 503 | aws-alb-http-503-issues (3.0초) | 0 |
  | 데이터베이스 교착 상태 오류 | 없음 | 0건 + 결과 없음 안내 (4.0초) | - |

  같은 조건 반복은 0.0초, 캐시. 첫 실행에서 "curl에서", "ALB에서"가 제품 필터에 걸리지 않는 버그를 발견해 고쳤고, 위 표는 수정 후 결과다. 수정 전에도 LLM 판정 결과에는 위반이 없었다.
- 화면 확인: 조건 탐색에서 카드 2건, 필터 "AWS ALB", 판정 불가 조건이 표시됐고, 카드를 누르면 "ALB HTTP 504 오류" 대화로 이동했다. 처음에는 StrictMode 재마운트 때문에 결과를 조회하지 않는 버그가 있어 수정했다.
- 검증: 백엔드 31개 OK(test_explore 6개 추가), vitest 175, typecheck, build 통과.
- 한계: 판정 품질은 질의 5개로만 봤다. 정답 조건표 기반 재현율(빠진 항목, 예: curl-35·58·98을 "인증서 검증"에 넣을지)은 판단 기준을 정하지 않았다. 과제의 검증 기준인 "조건과 맞지 않는 항목이 섞이지 않는지"만 확인했다.
- 다음 한 가지 작업: F2010 공개 실습 기록 기반 게임 코치(필수). 정답 정보(faults·answerId·solutionPath·state)를 보내지 않는 요청 계약부터 시작한다.

## 이전 상태 — F2004 외부 후보 검색 (2026-10-21 15:20~15:40, 아래 기록보다 우선)

- 설계: 02 명세 §4의 "공식 문서 카탈로그" 방식이다. 새 출처(위키백과 등)는 추가하지 않았다. 후보는 `sources.json`에 등록한 공식 페이지 8개의 절에서만 나오며, 모델은 URL을 만들 수 없다.
- 구현:
  - `scripts/build_section_catalog.py` → `catalog/section_catalog.json`: 669개 절(curl 매뉴얼 365, libcurl CURLE 87, errno 127, connect 16, open 26, write 12, ALB 문제 해결 32, 헬스체크 4)과 version 해시를 만든다. 원문 캐시만 써서 HTTP 0회. 이미 카탈로그에 있는 (URL, 절)은 같은 doc_id를 재사용한다.
  - `app/discovery.py`의 역할:
    - 검색어 토큰과 제목·요약을 맞춰 보는 키워드 후보 검색(`CANDIDATE_LIMIT`=8).
    - 프롬프트 2 입력은 제목·요약·제품만 보낸다.
    - 후보 밖의 ID는 거부하고, 자체 문서를 맨 앞에 강제로 넣는다. 추가 문서는 최대 `MAX_SELECTED_DOCUMENTS`=4개.
    - 이 항목으로 색인되지 않은 문서만 수집·청킹·임베딩한다(metadata `origin=query_selected`).
    - 검색어 캐시: 항목+정규화 검색어+카탈로그 버전이 키다(`data/corpus/query_cache`).
  - `corpus.py`: `chunk_rows`·`cached_vectors`로 분리했다(corpus_hash 불변 확인). `prepare` 캐시 판정을 건수 대신 기본 청크 ID 존재로 바꿔, 질문 중 추가된 청크가 있어도 다시 색인하지 않는다.
  - `rag.py`: PROMPT_VERSION=discovery-1. 이전 답변 캐시는 쓰지 않는다. trace에 candidate/selected/excluded/collected_ids, 이유, 수집 임베딩 호출 수를 남긴다. 진행 단계 `select_cache`·`collect`를 추가했고 React 진행 문구에도 반영했다.
  - jobs: 출처 오류(절 없음·HTTP 오류·429·robots 거부)를 안전한 사용자 문구로 바꾼다.
- 실행 검증(실측, 8000 서버 API, data/chroma-100):
  - Q1 "write에서 ENOSPC와 EDQUOT는 각각 어떤 조건에서 발생하나요?" (항목 ENOSPC): 18.2초. 단계는 search_terms→select_documents→collect→retrieve→generate. 후보 11개 중 선정 3개(errno ENOSPC, write ENOSPC, write EDQUOT), 제외 8개는 이유를 기록했다(curl-exit-70은 다른 제품이라 제외 등). 새 수집은 linux-write-EDQUOT이다. 본문 HTTP 0회(캐시), 임베딩 0회(같은 본문 벡터가 이미 캐시에 있음). 인용 2건이며, 그중 1건이 질문 중 수집한 문서다. 이전(F2004 전)에는 EDQUOT 조건을 "확인되지 않음"으로 보류했던 질문이다.
  - Q1 반복: 0.0초, 답변 캐시.
  - Q2(표현을 바꾼 질문): 검색어가 달라 검색어 캐시는 미적중. 선별 결과는 같은 3개, 재수집 0, 임베딩 0, 벡터 캐시 파일 수 316 그대로.
  - 화면(5173): Q1 답변과 근거 카드 "write(2) ERRORS: EDQUOT"가 표시됐다.
  - 한계: 실측에서는 새 본문 임베딩이 실제로 발생하는 경우(벡터 캐시에 없는 문서)를 겪지 않았다. 이 경로는 단위 테스트로만 확인했다.
- 테스트: 백엔드 25개(test_discovery 4개 추가) 3회 연속 OK. 게임 vitest 175 통과, typecheck 통과.
  - 간헐 실패: Chroma `InternalError: Error creating hnsw segment reader: Nothing found on disk`. 색인 직후 다른 클라이언트로 다시 여는 테스트에서 1/18회 관찰했다. 같은 벡터만 쓰던 테스트 고정값(다른 원인)은 문서별로 다른 벡터로 고쳤다. 고친 뒤 test_rag 30회 연속 통과. 근본 원인(Chroma 디스크 반영 시점)은 미해결이다.
- 시험 데이터 정리: 첫 시험에서 제목이 원문 첫 줄로 나와 man 페이지 절 제목 형식을 고쳤다. 그 시험에서 만든 query_selected 청크 1개, 답변 캐시 1개, 검색어 캐시 1개를 지우고 다시 실행했다.
- 8000 서버: 코드 반영을 위해 미리보기 `api`로 두 번 재시작했다. 실행 중이다.
- 다음 한 가지 작업: TASKS 순서상 F2005/F2006 설정 변경 비교(청크 크기·Top-k)다. 기능 공백으로는 F2011 조건 탐색과 F2010 실습 코치가 남았다. 일정상 F2011을 먼저 하자고 제안한다.

## 이전 상태 — 100건 색인 (2026-10-21 15:13~15:20, 아래 기록보다 우선)

- 사용자 승인 후 `CHROMA_PATH=data/chroma-100`으로 `scripts.prepare_corpus` 실행(실측):
  - 1회차: knowledge_items 100, reference_chunks 221, 원문 문서 189, corpus_hash 542fda4d…, 3,072차원, 소요 약 17초.
  - 임베딩 API 호출 11회(`embedding_batches`, 32건 단위 배치). 벡터 캐시 파일 42 → 316(새 임베딩 텍스트 274개). 나머지 47행은 같은 텍스트라 캐시를 재사용했다. 토큰 사용량은 수집하지 않아 크레딧 소모는 미측정.
  - HTTP 2회(kernel.org robots.txt와 이용 조건 페이지; robots.txt 404).
  - 2회차: 건수 동일, HTTP 0, 임베딩 0, cache_hit true.
  - 청크 길이: 최소 20 / 최대 996 / 평균 278자, 청크 ID 중복 없음, 100개 항목 모두 청크 보유. 제품별 청크 curl 96 / Linux 82 / ALB 43.
- 실제 질문 1건(신규 항목 linux-errno-ENOSPC, 생성 3회+임베딩 1회 유료): 15.2초. errno(3)·write(2) ENOSPC 근거 인용 3건. EDQUOT 상세 조건은 "원문에서 확인되지 않음"으로 보류했다(검색 범위가 선택 항목으로 제한되는 설계 때문). 선별 단계는 open(2) ENOSPC를 제외 사유와 함께 기록했다.
- `backend/.env`의 CHROMA_PATH를 `data/chroma-100`으로 바꿨다(이 줄만 변경). 임시 서버(8001, `.claude/launch.json`의 `api-8001`)로 확인: health 100/221, /api/items 100건, index_ready true, ENOSPC 질문은 캐시에서 응답. 확인 후 8001은 종료했다.
- 8000번 서버 재시작(사용자 요청): 기존 uvicorn 프로세스(PID 29860·31440)를 종료하고 `.claude/launch.json`의 `api` 설정으로 다시 띄웠다(Claude 앱 미리보기가 관리하며, 세션이 끝나면 다시 실행해야 할 수 있다). Vite 5173은 기존 프로세스 그대로다. 화면 실측: 상태 줄 "지식 100건", 지식 탭 항목 100개, ENOSPC 질문 → 근거 3건(항목 메타데이터/공식 상세 문서 구분, 라이선스 표시), 캐시 응답. 지식 화면 안내 문구 "10개 주제 파일럿"을 항목 수 기반 문구로 수정(typecheck 통과, 화면에서 "100개 주제" 확인).
- 기존 `data/chroma`(10건 파일럿)는 지우지 않고 보존했다.
- 알려진 작은 문제: man7 문서의 근거 URL에 붙는 `#ERRORS/ENOSPC` 같은 조각은 실제 HTML 앵커가 아니다(페이지는 열리지만 해당 위치로 이동하지 않음).
- 다음 한 가지 작업: TASKS 순서상 "수집/색인 스크립트·캐시·안정 ID(F2001~F2005)" 점검이다. 남은 핵심 공백은 F2004의 외부 후보 검색이다. 지금은 항목별로 미리 검토한 문서 안에서만 선별한다.

## 이전 상태 — 100건 카탈로그 (2026-10-21 15시대, 아래 기록보다 우선)

- 구현 완료:
  - `backend/catalog/`: 입력 `shortlist_100.json`(docs의 후보 목록 복사), `sources.json`(출처 8개·라이선스), `shared_documents.json`(curl 옵션·ALB 헬스체크 절), `annotations_ko.json`(한국어 제목·증상·요약·분류, LLM 보조 작성). 생성물 `items.json` 100건, `documents.json` 189개.
  - `app/catalog.py`: 하드코딩 10건 → JSON 로더(pydantic, 중복 ID·미등록 문서·주 문서 첫 순서 검사). 색인 텍스트에 원문 발췌(`source_excerpt`, 최대 600자) 포함.
  - `app/collectors.py`: man7.org 추출기(`h2절/오류이름` 단락, 같은 이름의 여러 조건 모두 수집), man-pages 버전 감지(6.19), charset 없는 응답을 UTF-8로 해석(AWS 문서의 깨진 대시 수정). Collector에 문서 목록 주입 가능.
  - `scripts/build_catalog.py`(생성), `scripts/validate_catalog.py`(검증), `tests/test_catalog.py` 5개.
- 실행 검증(실측):
  - `scripts.build_catalog`: items 100, documents 189, 주 문서 실패 0. 보조 문서 1건 제외(connect(2)에 EPERM 절 없음).
  - `scripts.validate_catalog`: 고유 100, curl 40/Linux 40/ALB 20, 보조 문서 있는 항목 74, 주 문서 80자 미만 70, 라이선스 curl 85·GPL-2.0-or-later 40·Linux-man-pages-copyleft 42·CC-BY-SA-4.0 22, failures 0, exit 0, HTTP 0(캐시).
  - 백엔드 unittest 21개 OK (연속 4회). 수정 직후 1회는 실패로 끝났으나 원인을 재현하지 못했다. 이후 연속 5회 통과.
- 결정:
  - `scenario_ids`는 모두 빈 배열이다. `/api/items`가 브라우저에 항목 전체를 주므로, 연결해 두면 실습 정답 힌트가 될 수 있다. 실습 코치(F2010) 작업에서 서버 전용 필드로 다룬다.
  - 한국어 요약에는 원문에 없는 원인·조치를 쓰지 않았다. "원문은 원인을 특정하지 않는다"를 명시했다. 사람 검수는 아직 하지 않았다.
- 출처 접근 기록(NF2006): man7.org robots.txt는 해당 경로를 허용한다. **주의:** 라이선스 확인용으로 git.kernel.org에서 man 소스 4개 머리말을 curl로 직접 받았는데, 이후 확인한 git.kernel.org robots.txt는 `User-agent: * Disallow: /`이다. 제품 수집기에는 git.kernel.org를 넣지 않았다. 앞으로 이 호스트는 자동 요청하지 않는다. 라이선스 근거는 그때 확인한 SPDX 표기다(errno.3 GPL-2.0-or-later, connect/open/write.2 Linux-man-pages-copyleft). 다만 `h=man-pages-6.19` 태그와 일치하는지는 확인하지 않았다(응답 .TH는 unreleased로 표시됨).
- 원문 캐시: AWS 2개·open.2 1개가 문자가 깨진 채로 저장되어 있어 다시 받았다. 이전 파일은 임시 폴더에 백업했다. 기존 10건 색인(data/chroma)은 깨진 대시가 포함된 이전 본문으로 만든 것이다.
- **현재 불일치:** 실행 중인 서버와 data/chroma는 10건 색인 그대로다. 카탈로그는 100건이므로 새로 추가된 90건을 선택하면 `selected_item_not_indexed`로 실패한다. `prepare_corpus`를 같은 경로로 실행하면 `corpus_changed_use_new_chroma_path`로 거부된다. 100건 색인은 새 `CHROMA_PATH`(예: data/chroma-100)에서 실행해야 하며 유료 임베딩이 필요하다(청크 수백 개 규모로 추정, 실측 전).
- 다음 한 가지 작업: 사용자 승인을 받은 뒤 새 경로에 100건을 색인한다. 재실행했을 때 건수가 변하지 않는지 확인하고, `.env`의 CHROMA_PATH를 바꾼 다음 서버를 재시작해 화면에서 확인한다.

## 이전 상태 — 10건 RAG 파일럿 (2026-10-21 15시, 아래 기록보다 우선)

이전 기록 이후 HANDOFF에 적히지 않은 파일럿 구현이 작업 트리에 있었다(미커밋). 이번에 실제 파일과 실행으로 확인하고 기록했다.

- 구현 완료(미커밋→이번 커밋 대상): `backend/app/` catalog(10항목·문서 허용 목록), collectors(robots·1초 간격·429 무재시도·원문 캐시·절 추출), corpus(두 컬렉션 색인·manifest·벡터 캐시), prompts(3종), rag(검색어→선별→retrieve/generate·인용 검증·답변 캐시), jobs(비동기 작업·안전 오류 문구), contracts(extra 필드 거부). main.py에 `/api/items`, `POST /api/chat`(202+job_id), `/api/jobs/{id}`. 스크립트 `prepare_corpus`, `evaluate_pilot`. React `KnowledgeScreen`·`src/api/knowledge.ts`·작업 탭.
- 실행 검증 완료(이번 세션 실측):
  - 백엔드 unittest 16개 OK, pip check OK. 게임 vitest 175 통과, typecheck·build 성공.
  - `scripts.prepare_corpus` 재실행: knowledge_items 10 / reference_chunks 48 불변, http_requests 0, embedding_batches 0, cache_hit true.
  - 파일럿 질문 3건 재호출: 모두 답변 캐시 명중(유료 호출 없음). 최초 실행 기록(pilot.json): 19.5s/16.7s/16.7s, 인용 3/3/0건, 문서 밖 질문은 "확인되지 않습니다" 보류.
  - 브라우저(127.0.0.1:5173): 지식 탭 10항목 표시, curl-28 질문→본문 [근거 N]과 근거 카드 3건·원문 URL 일치, 캐시 안내 표시.
  - 키 패턴 검색: 작업 트리(.env 제외)에서 발견 없음, backend/.env는 .gitignore 적용.
- 미검증/미구현: 100건 항목(F2001), 외부 후보 검색(현재 항목별 사전 목록만 선별, F2004), 청크 크기·Top-k 변경 비교, 키 누락·색인 0건 화면 확인, 조건 탐색(F2011), 공개 실습 기록 코치(F2010), RAG 전후 비교(F2015). AWS 문서 라이선스 표기(CC-BY-SA-4.0)는 출처 원문으로 재확인 필요(NF2007).
- 실행 프로세스: FastAPI 127.0.0.1:8000, Vite 5173 이미 실행 중이었음(이번 세션에서 띄운 것 아님).
- 다음 한 가지 작업: 고유 항목 100건 이상·연결 원문·출처/이용 조건 확보 — `data_feasibility/shortlist_100.json`을 KnowledgeItem 스키마로 변환하고 각 항목의 primary 문서 절이 실제 추출되는지 검사하는 스크립트부터.

## 이전 상태 (환경 구축 단계)

- 저장소: C:/Users/SSAFY/Documents/Codex/InfraCoach. 브랜치 master. 시작 커밋 0445608. 환경 구축 커밋 4322625 (로컬, 푸시 안 함).
- 기존 미추적 docs/infra-coach 문서·데이터 보존. HANDOFF/TASKS를 갱신했고 기존 기획 자료는 미추적 상태로 남김. 기존 엔진 변경 없음.
- Python 3.11.9 backend/.venv, 과제 PDF 지정 버전 설치. requirements.lock.txt에 전체 설치 버전 기록.
- 기존 게임 175개 테스트·타입 검사·빌드 통과. 백엔드 unittest 8개·pip check 통과.
- FastAPI /api/health, Chroma knowledge_items/reference_chunks, 두 노드 그래프 팩터리, 모델 어댑터/연결 CLI, React 상태 패널 추가.
- GMS gpt-6.1-sol Responses 실제 호출 성공 (2자 반환). 키는 backend/.env에만 존재하며 Git 제외.
- GMS text-embedding-3-large /v1/embeddings 실제 1건 호출 성공, 3,072차원 확인. backend/.env 및 예제에 반영. 추가 정규화 없음.
- 사용자 보고 잔액 약 70,000크레딧(2026-10-21). 실제 잔액 API 조회나 전체 사용 승인 한도는 아님. 제공 임베딩 단가는 토큰당 0.0013크레딧이며 이번 시험 토큰 사용량은 별도 수집하지 않음.
- 제품 색인은 0건. 실제 RAG 수집/검색/생성·채팅 API는 아직 미구현. 그래프 테스트를 RAG 완료로 표시하지 말 것.
- 실행 프로세스: FastAPI 127.0.0.1:8000, Vite 127.0.0.1:5173 (이 작업에서 실행). 실행 세션 종료 시 재실행 필요.
- 실행 방법 backend/README.md, 실제 증빙 06_개발환경_검증결과.md.
- 교육생배포용.zip 검토: Streamlit UI 참고 골격, 가짜 수집 데이터, RAG 구현 없음. React 유지 결정에 맞춰 흐름만 활용.
- 후속: manifest/10건 수집·색인/세 프롬프트 → 두 노드 RAG/인용/공개 기록 코치.
- 남은 기존 이슈: 100건 최종 정제·이용 조건, ALB fail-open 불일치, npm audit 5건 영향 분석.

## 이전 조사·설계 기록 (당시 상태)

# InfraCoach 현재 인수인계

갱신: 2026-10-21 · 단계: 구현·검증·제출 문서 완료. 셀프 체크리스트·상호 점검·제출은 사용자 몫

## 최신 작업 — 데이터 사전 조사

사용자가 데이터 확보 가능성 확인을 요청하여 공식 원문 3개를 실제 다운로드하고 후보 237건을 추출했다. curl 86 / Linux errno 123 / AWS ALB 28. 우선 검토 100건은 curl 40 / Linux 40 / ALB 20으로 선택했다. 파일은 data_feasibility/ 및 05_데이터_확보가능성_검토결과.md에 있다.

237건 중 187건의 설명이 80자 미만이다. 따라서 메타 후보 확보와 코칭 품질 확보를 구분해야 한다. 보강 원문 5개 접근 성공, 선택 Linux 40건 중 31건의 오류 이름이 connect/open/write 문서에 등장함을 확인했다. 의미 검수·한국어 메타·모든 항목의 진단 근거 보강·버전 고정·이용 조건 반영은 아직 필요하다. 최종 데이터 확보를 통과 처리하지 말 것.

이번 조사 스크립트와 원문 캐시는 현재 작업 폴더 work/data_audit/에 있다. 이는 제품용 수집기·색인기가 아니며 다음 구현에서 별도 정리해야 한다. 후보 목록은 최종 KnowledgeItem 스키마로 아직 변환하지 않았다. 서비스 코드·임베딩·생성 API·게임 테스트는 실행하지 않았다.

바로 다음 우선 작업은 100건 정제와 출처 버전·조건 확정이며, 환경 구축과 연결해 대표 10건 RAG를 검증한다. 아래 문단은 이전 설계 단계의 기록이며 데이터 상태는 이 최신 절과 05 보고서를 우선한다.

## 현재까지 실제 수행

원본 과제 PDF를 읽고 기존 게임 ZIP의 README·시나리오·세션·결과 화면·AWS 상태 코드를 일부 확인했다. 코드 실행·의존성 설치·RAG 구현은 수행하지 않았다. 생성한 문서는 이 폴더의 01/02/03 및 PROJECT/TASKS/본 문서/04 전환 가이드다.

## 현재 사용자의 요청과 처리 범위

요청: 제출물 6종과 기존 명세 비교, 도메인의 근거 필요성 확인, Claude로 이어갈 준비.
처리: 누락을 점검하고 검증·상호·사전 셀프 양식 보완, 도메인 선정 근거와 초기 검색 설정 선정 이유 추가, 인수인계 문서 준비.
아직 프로젝트 구현을 이번 요청으로 시작하지 않았다. 다음 사용자의 구현 요청이 있으면 TASKS의 순서로 진행한다.

## 알고 있는 중요한 문제

1. 기존 ALB 시나리오는 ‘모두 unhealthy → 항상 503’을 전제하지만 공식 문서는 모든 타깃 unhealthy 시 fail-open을 설명한다. 시나리오 인과관계를 수정해야 한다.
   근거: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
2. 100건 데이터·연결 문서·출처 이용 조건은 아직 확보·검증되지 않았다.
3. GMS의 모델/임베딩과 개인 API 공급자는 미확정이다.
4. 공식 셀프 양식은 아직 받지 않았다. 상호 점검도 실시하지 않았다.
5. 신규 RAG용 실행 README와 구현 소스가 없다. 기존 게임은 ZIP에 있으며 이 작업 폴더에 추출하지 않았다.
6. ‘실습 3개 세밀화·새 환경 1개’는 3일 범위에 맞춘 제안이다. 사용자는 더 다양한 환경과 세밀함을 원한다.

## 재개할 때

먼저 실제 코드·문서·Git 상태를 확인한다. 이 문서의 과거 상태보다 실제 파일을 우선하고 차이가 있으면 갱신한다. 원본 게임 ZIP이나 저장소를 읽을 수 없으면 사용자에게 소스를 요청한다. 기록 없이 프로젝트를 새로 만들거나 기존 구현을 덮어쓰지 않는다.

## 다음 교체 직전에 채울 항목

- 실제 작업 저장소: 아직 미확정
- 브랜치/커밋: 아직 확인하지 않음
- 커밋되지 않은 변경: 프로젝트 저장소 확인 전
- 마지막 구현 파일: 없음
- 실제 실행한 프로젝트 테스트와 결과: 없음
- 현재 실행 프로세스/포트: 프로젝트 실행 없음
- 데이터/색인 manifest 위치·건수: 아직 없음
- 다음 한 가지 작업: 구현 요청 시 저장소 확인 및 기존 게임 실행 검증
- 진행 중 오류/재현 절차: 프로젝트 미실행; 알려진 ALB 설계 문제는 위 참고

위 항목을 새 작업 상태로 바꾸고 TASKS도 갱신한다. 과거 ‘미구현’ 기록이 실제 구현 후에도 남지 않도록 한다. 비밀 키·토큰·개인정보는 포함하지 않는다.
