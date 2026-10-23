# GPT 인수인계 프롬프트 — 시나리오 추가 · 커뮤니티 게시판 백엔드 연동

작성: 2026-10-22 · 기준 커밋: `feature/sudo-quest`의 이 문서를 추가한 커밋(그 직전 `5933bd4`)

## 쓰는 법

1. GPT가 저장소 폴더를 직접 열 수 있으면 아래 프롬프트만 붙여넣는다.
2. 파일 업로드 방식이면 소스와 `docs/`를 함께 올린다. **`backend/.env`, `node_modules`, `backend/.venv`, `dist`, `backend/data/chroma*` 는 올리지 않는다.** (키는 `.env`에만 있고 문서에는 없다.)
3. 두 도구가 같은 파일을 동시에 고치지 않게, 넘기기 전에 Claude 쪽 작업을 멈추고 커밋 상태를 맞춘다.
4. 시작할 작업을 하나만 고르려면 프롬프트 마지막 줄의 "작업 A / 작업 B"를 지워서 보낸다.

---

## 복사해서 붙여넣을 프롬프트

```text
SUDO QUEST(저장소 이름 truble-shooting-game) 작업을 이어받아 주세요.
이전 작업은 Claude가 했고, 대화 기억은 넘어오지 않습니다. 저장소의 코드와 문서를 기준으로 이어갑니다.

## 이 프로젝트
- 브라우저 안 가상 터미널에서 명령을 입력해, 일부러 망가뜨린 "가상 서버"의 장애 원인을 찾고 복구하는 학습 게임.
  화면 이름은 SUDO QUEST(아이소메트릭 네온 캠퍼스 + 게임 HUD). 목적: 혼자 공부, 스터디원에게 링크로 공유, GitHub 포트폴리오.
- 프런트: React 19 + TypeScript + Vite. 런타임 의존성은 react, react-dom 뿐(추가하려면 이유를 먼저 설명하고 물어볼 것).
- 백엔드: backend/ 의 Python 3.11 + FastAPI. 공식 문서 RAG 코치(지식 탐색·실습 중 코치). Chroma 색인, GMS 제공자.
  "서버/API 키 없음" 규칙은 게임 엔진에 대한 것이고, RAG 확장 뒤로는 서비스 전체에 적용되지 않습니다.
  단, 게임 자체는 백엔드 없이도(정적 GitHub Pages) 동작해야 하고, 백엔드가 꺼져 있으면 코치처럼 "연결 안 됨"으로 우아하게 물러나야 합니다.

## 먼저 읽을 것(이 순서)
1. CLAUDE.md — 항상 지킬 규칙(엔진 원칙·명령 구현 규칙·시나리오 규칙·테스트 규칙·코드 스타일). 이 프로젝트의 헌법입니다.
2. docs/infra-coach/HANDOFF.md 맨 위 "최신 상태" 몇 개와 TASKS.md의 "2026-10-22 사용자 피드백" 절.
3. docs/SCENARIO_GUIDE.md — 시나리오 추가 방법, 근거 자료(evidence) 규칙, "새 분류(운영실) 추가".
4. docs/infra-coach/11_확장_계획_도커_K8s_시나리오.md — 도커·K8s 조사, 문제 후보, 라이선스.
5. 실제 코드: src/engine/(state, commands, scenario, judge, session), src/scenarios/, src/ui/categories.ts,
   src/ui/campus/(rooms.ts, layout.ts, art/), backend/app/(main.py, contracts.py, coach.py, config.py).
문서와 코드가 다르면 코드가 맞습니다. 다른 점을 찾으면 먼저 짧게 알려 주세요.

## 현재 상태(2026-10-22 기준, 직접 다시 확인할 것)
- 브랜치 feature/sudo-quest(master에서 분기, 17개 이상 앞섬). push하지 않았습니다. master 병합은 사용자 결정.
- 검증: npm run typecheck 통과, vitest 358개 통과(16파일), npm run build 통과(JS 507kB로 Vite 500kB 경고만), 백엔드 unittest 40개 통과.
- 시나리오 13개(linux 4, network 3, web-db 3, aws 3). 모든 시나리오에 evidence(공식 문서·공개 포스트모템 링크) 필수.
- 분류는 src/engine/scenario/categories.ts 의 CATEGORY_IDS가 원본. docker·kubernetes는 이미 들어 있지만 시나리오 0개인
  "준비 중" 분류입니다(src/ui/categories.ts 의 comingSoon: true). 방(아이소메트릭 그림)은 완성돼 있습니다.
- 캠퍼스 3×3 격자가 꽉 찼습니다: 자료실[0,0] 네트워크[1,0] 컨테이너[2,0] / 리눅스[0,1] 관제실[1,1] 클라우드[2,1] /
  쿠버네티스[0,2] 웹·DB[1,2] 커뮤니티실[2,2]. 문·복도·지도 크기·미니맵은 layout.ts가 칸에서 계산합니다.
- 커뮤니티실은 카페 그림만 있고 게시판 기능은 없습니다(누르면 HUD에 "게시판 준비 중"만 뜸).
- 로컬 실행(Mac): .claude/launch.json 의 "dev"(5173)와 "api-mac"(8000). Windows용 설정은 그대로 두세요.
  backend/.env 의 LLM_MODEL은 비용 때문에 테스트용 모델로 바꿔 둔 상태이고, 제출 전 되돌릴지는 사용자 결정입니다.

## 절대 지킬 것(사용자가 직접 정한 문장 그대로 포함)
- 게임 명령으로 실제 시스템 명령을 실행하지 마. (child_process·exec·fs로 실제 실행 금지. 모든 것은 메모리 속 가상 상태)
- 코치 요청에 faults, answerId, solutionPath, 전체 state 같은 숨겨진 정답 정보를 보내지 마.
  (evidence 제목·주소도 원인을 드러내므로 코치 요청과 브리핑에 넣지 않고 클리어 리포트에만 보여 줍니다. 테스트가 막습니다.)
- 장식용 서버 랙을 실제 모니터링 데이터처럼 표시하지 마.
- 키는 사용자가 직접 입력해. 기존 .env를 덮어쓰거나 키 값을 출력하지 마.
- VITE_* 변수나 브라우저 코드에 비밀 키를 넣지 마. 비밀 키는 인수인계 문서에 기록하지 마.
- 과거 Windows 검증 결과를 현재 Mac의 검증 결과로 취급하지 마. 실제로 실행한 검사만 "검증"이라고 쓰세요.
- 기존 변경과 프로세스를 보존해. 완료·미완료·미검증을 구분해서 보고해.
- push는 하지 마. 커밋은 의미 단위로 하되 커밋 메시지는 한국어로.
- 티켓(장애 신고)에 원인을 노출하지 마. 명령 출력은 시나리오에 하드코딩하지 말고 상태에서 계산.

## 일하는 방식
- 설명은 한국어로. 사용자는 게임 개발 경험이 없고 장애 대응을 공부하는 중이라, 코드를 읽고 이해하는 과정이 중요합니다.
- Phase 단위로 작게: 시작 전에 계획(만들 파일·바꿀 파일·테스트)을 보여 주고 승인받기 → 끝나면 파일 구조와 핵심 흐름을 짧게 설명하고 멈추기.
- 트레이드오프가 있으면 왜 그렇게 골랐는지 1~2문장.
- 파일은 200줄을 넘기지 않게 쪼개고, 복잡한 로직에는 "왜"를 설명하는 한국어 주석. any 금지.
- 기능 하나를 끝낼 때마다 docs/infra-coach/HANDOFF.md 맨 위에 "최신 상태"(바꾼 파일과 이유, 실행한 명령과 결과,
  남은 오류와 재현 방법, 실행 중인 서버와 포트, 커밋/미커밋, 사용자 결정·질문, 다음 작업)를 쓰고 TASKS.md를 갱신.
- 명령을 직접 실행할 수 없는 환경이면 그 사실을 먼저 말하고, 결과를 추측해서 쓰지 마세요.

## 검사 명령(저장소 루트)
- npm run typecheck
- npx vitest run      (시나리오는 등록만 하면 자동 검증: 주입 직후 미복구, 모범 풀이로 복구, 풀이 명령 전부 exit 0, 스키마)
- npm run build
- 백엔드 테스트: (backend 폴더에서) .venv/bin/python -m unittest discover -s tests
  (저장소 루트에서 -s backend/tests로 돌리면 app 모듈을 못 찾아 실패합니다)
- 백엔드 카탈로그: (backend 폴더에서) .venv/bin/python -X utf8 -m scripts.validate_catalog
- 화면 확인이 가능하면 5173에서 직접 눌러 보고 결과를 적기. 캠퍼스 그림의 글자 넘침은 브라우저에서 text.getBBox()와
  감싸는 rect를 getCTM으로 같은 좌표계에 옮겨 비교하는 방식으로 확인했습니다(HANDOFF 2026-10-22 "호버 외곽선·글자 넘침").

## 작업 A — 시나리오 추가(권장 순서: K8s 3 → Docker 2 → Linux·Web 3, 13 → 21~24개)
목표: docker·kubernetes 방을 실제 실습으로 엽니다. 엔진을 일반화하고, 시나리오는 데이터 파일 하나씩.
1. 엔진 상태 모델(출력은 반드시 이 상태에서 계산):
   - K8s: SystemState에 kubernetes?(nodes, deployments(replicas, template의 image·command·env·resources.limits·readinessProbe),
     pods(phase, ready, restartCount, containerStatuses의 state/lastState: waiting reason CrashLoopBackOff·ImagePullBackOff,
     terminated reason OOMKilled exitCode 137), services(selector), events). Service의 endpoints는 selector와 일치하는
     Ready 파드에서 계산. 파드 상태는 deployment 템플릿과 이미지 목록·메모리 사용량에서 계산되게 해서
     `kubectl set image`/`rollout undo`/`set resources` 후 출력이 저절로 바뀌어야 합니다.
   - Docker: SystemState에 docker?(images: 레이어·크기, containers: name·image·status·exitCode·ports·env·logs·restartCount).
     `docker system df`는 이미지·컨테이너·빌드 캐시 크기 합, 포트 충돌은 기존 network의 리스닝 소켓과 함께 계산.
   - 장애 주입(faults)은 배열로 여러 개 적용 가능하게 유지. 시뮬레이션 시각(clock)과 metrics 자리도 비워 둡니다.
2. 명령(1파일 = 1명령, src/engine/commands/docker.ts, kubectl.ts — 길면 하위 파일로 분리):
   - kubectl get pods|deploy|svc|endpoints|events [-o wide], describe pod|deploy, logs [--previous] [-c],
     rollout status|undo, set image, set resources, delete pod. 출력 형식은 실제 kubectl과 최대한 같게.
   - docker ps [-a], logs, images, inspect, start|stop|rm, system df, system prune [-f], port.
   - 모르는 하위 명령·옵션은 실제 CLI 문구로 거절(게임식 안내 금지). sudo/권한 규칙 유지.
   - 코치가 지원하지 않는 하위 명령을 제안하지 않도록 aws처럼 operations 목록을 Command.operations로 내보내기
     (src/engine/commands/aws.ts의 AWS_OPERATIONS, commands/index.ts의 commandOperations·supportsInvocation 참고).
     백엔드 contracts.py의 command_operations는 명령 10개까지만 받습니다.
3. 시나리오 후보(11_ 문서 참고): K8s — CrashLoopBackOff(설정·명령 오류), OOMKilled(메모리 limit), ImagePullBackOff(태그 오타),
   (선택) readiness 실패 503, 잘못된 Service selector. Docker — 포트 이미 할당, 이미지·캐시로 디스크 가득, 환경변수 누락으로 즉시 종료.
   Linux·Web — nginx 502 업스트림 다운, inode 고갈(df -i), Too many open files.
   각 시나리오: 증상만 쓴 티켓, 단서가 출력 안에 반드시 존재, 헷갈리는 오답 + whyWrong, 무관한 정상 로그 섞기,
   3단계 힌트(방향 질문 → 볼 곳 → 거의 정답), 포스트모템 4항목(무슨 일/왜/어떻게 고치나/어떻게 예방하나),
   evidence 1개 이상(공식 문서나 공개 포스트모템 필수, 링크를 직접 열어 확인).
4. 분류 열기: 그 분류의 첫 시나리오를 넣을 때 src/ui/categories.ts 의 comingSoon: true 를 지웁니다.
   둘 중 하나만 하면 tests/campus.test.ts가 실패합니다.
5. 테스트: 새 명령마다 출력 단위 테스트, 상태 변경 후 출력이 바뀌는지, 시나리오 문구 속 명령이 지원되는지(command-coverage).
   코치 요청에 숨겨진 정보가 없는지는 tests/coach.test.ts가 자동으로 검사합니다.
6. (선택) RAG 지식에 K8s·Docker 공식 문서를 넣을 수 있습니다. 라이선스 CC-BY-4.0, Apache-2.0은
   backend/app/catalog.py ALLOWED_LICENSES에 이미 허용돼 있습니다. 넣으면 validate_catalog 실패 0을 확인.

## 작업 B — 커뮤니티 게시판 백엔드 연동
먼저 사용자에게 저장 방식을 결정받으세요(아직 미정). 장단점과 추천을 짧게 보여 주고 고르게 합니다.
- 선택지 1: 지금의 FastAPI 백엔드 + SQLite(파이썬 표준 sqlite3, 새 의존성 없음). 오프라인·로컬 시연에 강하고 통제가 쉽지만,
  정적 GitHub Pages 배포에서는 백엔드가 없으니 게시판이 "연결 안 됨"으로 보입니다(백엔드 배포는 아직 없음).
- 선택지 2: GitHub Discussions 임베드(giscus 등). 서버가 필요 없지만 외부 스크립트·GitHub 로그인이 필요하고,
  "외부 라이브러리 최소화" 규칙과 개인정보(로그인) 측면에서 사용자 확인이 필요합니다.
선택지 1로 가면 지킬 것:
- API 예: GET /api/posts?cursor=, POST /api/posts, GET /api/posts/{id}, POST /api/posts/{id}/comments, DELETE(관리자만).
  backend/app/contracts.py처럼 Pydantic 모델 extra="forbid", 길이 제한(제목·본문·닉네임), 분류 태그(Q&A·스터디·장애 후기·TIL 등).
- 보안: 본문은 텍스트로만 렌더링(HTML 해석 금지, dangerouslySetInnerHTML 금지), IP/세션 단위 작성 속도 제한,
  관리자 삭제 토큰은 서버 .env에만(VITE_ 금지, 문서 기록 금지), 개인정보는 받지 않음(익명 닉네임).
  CORS는 config.py의 cors_origins만. 비밀번호 기반 수정/삭제를 넣으면 해시 저장.
- 데이터 파일 위치는 backend/data/ 아래(.gitignore 확인), 스키마 버전·마이그레이션 메모를 HANDOFF에.
- 프런트: 해시 라우트 #/community 추가(src/ui/route.ts), 커뮤니티실 클릭 시 이동(src/ui/campus/IsoCampus.tsx의 enter,
  rooms.ts FIXED_ROOMS의 community soon 해제), 화면은 기존 지식 탐색처럼 game.css 스타일로.
  백엔드 상태 확인은 src/api/health.ts 패턴을 따르고, 꺼져 있으면 게시판만 안내 문구로 대체(게임은 정상).
- 테스트: 백엔드 unittest(작성·목록·길이 제한·속도 제한·삭제 권한·HTML 이스케이프), 프런트는 라우트·연결 끊김 처리.

## 알아 두면 덜 헤매는 것
- 상태 변경은 structuredClone 복사본에. 명령 결과 모양은 { stdout, stderr, exitCode, state }.
- 파이프(|)는 run.ts의 splitPipeline으로 단계마다 stdin 전달. 새 명령도 stdin을 받을 수 있게.
- 캠퍼스 그림: 화면에서 뒤 → 앞(x+y가 작은 것부터) 순서로 그려야 가림이 맞습니다. 방 안 그림은 RoomShell이
  이름 간판을 그린 뒤에 그려지므로 벽 위 장식이 간판 글자를 가리지 않게 자리를 잡으세요.
- 새 분류를 더하면 CATEGORY_IDS 한 줄 → 컴파일 오류가 ui/categories.ts·campus/themes.ts·art/RoomArt.tsx를 가리킵니다.
  3×3은 꽉 찼으므로 더 넓히려면 GRID_SIZE를 늘리고 바깥 칸을 씁니다(layout.ts가 지도·미니맵을 계산).
- 브라우저 저장소: 진행 기록은 localStorage "incident-game/v1", 실습 세션·코치 대화는 sessionStorage. 검사하면서 만든 기록은 지우고 보고.

## 첫 응답에서 할 일
1. git status·git log -5·브랜치를 확인하고, HANDOFF/TASKS와 다른 점을 짧게 보고.
2. 아래 작업 중 첫 Phase의 계획(파일 목록·상태 모델 타입 초안·테스트 목록)을 보여 주고 승인 대기. 아직 코드를 고치지 마세요.
이번에 할 작업: 작업 A(시나리오 추가) / 작업 B(게시판 백엔드 연동)
```

---

## 넘기기 전 체크(사용자용)

- [ ] Claude 쪽 작업이 커밋까지 끝났는지(`git status`가 비어 있는지)
- [ ] 5173·8000 서버를 계속 켜 둘지(GPT가 같은 포트를 쓰면 충돌)
- [ ] 게시판 저장 방식을 미리 정했다면 프롬프트 작업 B의 "선택지" 부분을 결정 문장으로 바꾸기
