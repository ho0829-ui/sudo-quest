# Claude에 붙여 넣을 이어가기 프롬프트

```text
SUDO QUEST 작업을 이어받아줘. 한국어로 소통하고 대화 기억보다 최신 코드·인수인계 문서를 기준으로 판단해.

저장소: /Users/jaeho/Developer/truble-shooting-game
브랜치: feature/sudo-quest (현재 상태는 git으로 다시 확인)

먼저 git status·최근 커밋·실행 서버를 확인하고, 적용되는 AGENTS.md/CLAUDE.md, docs/infra-coach/HANDOFF.md의 맨 위 최신 기록, TASKS.md, 15_CLI_로딩_퀘스트_연출.md, README.md, backend/README.md를 읽어.

현재 구현:
- 가상 장애 대응 게임 + FastAPI RAG + SQLite 게시판.
- 게시판은 이미 2단계까지 구현됐다. 글/댓글/검색/분류/페이지네이션/작성 제한, 작성자 비밀번호 삭제, 관리자 삭제, 풀이 숨김, 코드 블록, 초안 보관, 실습 회고 연결이 있다. 새로 만들지 마.
- Claude가 react-vendor·실습 화면·명령 엔진·세션 복원을 분리했다. 이 지연 로딩을 유지해.
- 최신 사용자 요청으로 작은 도트 CLI 로딩과 퀘스트 대화 연출을 추가했다.
- 조사 시작 → 안경·수염 있는 운영자 도윤이 1.6초 줌인 → 공개 신고 설명 → 도움 요청 → 퀘스트 수락 → 기존 CLI.
- 수락 전에는 세션/타이머를 시작하지 않는다. 취소/Esc/건너뛰기/포커스 순환/모션 끄기 지원. 이어하기는 바로 CLI로 간다.
- 담당자 원화는 사용자가 첨부한 픽셀 초상의 아래 줄 안경·수염 인물을 참고해 SVG로 작성했다. 최종 사용자 디자인 피드백은 아직 받지 않았다.

주의할 작업 트리:
- UI 작업 재개 당시부터 Web 확장(nginx upstream 502, TLS 체인) 관련 파일이 미커밋이었다.
- src/engine/commands/{nginx,text,tls}.ts, state/{types,network,services,hosts/ubuntuWeb}.ts, 새 certs/dns/webServer/config/nginxSites, src/scenarios의 새 Web 2개와 index, tests/web.test.ts 및 scenario-exploration.cases.ts.
- 이 변경은 UI 작업과 구분해 보존했다. git status로 실제 남은 파일을 확인하고 지우거나 무작정 되돌리지 마.
- 커밋된 기준은 22개 시나리오였고 미커밋 Web 2개 포함 작업 트리는 24개였다. 숫자는 현재 코드 기준으로 확인해.

다음 진행:
1. 사용자의 최신 디자인 피드백이 있으면 먼저 반영해. 로더 크기/도트 움직임, 얼굴/수염/안경, 줌인 구도·속도·대사를 조정할 수 있다.
2. 미커밋 Web 확장의 구현 상태·탐색 테스트·근거 문서·브라우저 동작을 확인하고 필요한 안정화를 완료해. 이전 사용자 승인 범위를 문서와 대조해.
3. 게시판 추가 기능 후보(글 수정/신고/정렬 등)는 미완료이며 별도 범위다. 기존 기능을 중복 구현하지 마.

직전 실제 검증(과거 기록이므로 현재 다시 확인 없이 통과라고 말하지 마):
- 프론트 762개/31파일, 타입 검사, 빌드 통과. 미커밋 Web 확장 포함.
- 번들 index 340.39kB, vendor 221.70kB, QuestBriefing 8.64kB. 빌드 크기 경고 없음.
- 375×812/812×375 가로 넘침 없음. 퀘스트 수락→pwd 실행, 이어하기, 취소, Tab 순환, 모션 끄기, 건너뛰기 확인.
- UI 범위 밖 network.ts EOF 빈 줄 1건이 전체 git diff --check에서 지적됐다. 필요하면 해당 Web 작업과 함께 정리해.
- 이번 UI 단계에서 백엔드 테스트/실제 RAG 호출/재색인을 하지 않았다.
- Vite 5173 PID 87647, FastAPI 8000 PID 74575가 실행 중이었다. 기존 사용자 탭·학습 기록을 보존해.

원칙:
- 게임 명령은 순수 TypeScript 가상 상태만 바꾼다. 실제 시스템 명령을 게임에서 실행하지 마.
- 코치/퀘스트 대사에 faults, answerId, solutionPath, 전체 state 같은 숨은 정답을 보내거나 노출하지 마.
- .env는 덮어쓰거나 키 값을 출력하지 마. 비밀 키는 VITE_*나 브라우저 코드/문서에 넣지 마.
- 초기 문서의 서버/DB/API 키 없음은 RAG·게시판 확장 전 설명이다.
- 계획을 짧게 알린 후 승인된 범위를 진행해. 테스트·브라우저 검증·HANDOFF 맨 위/TASKS 갱신·의미 단위 커밋 후 Phase를 마쳐.
- 완료/미완료/미검증을 구분하고 실행 서버·검증 명령·남은 변경·다음 작업을 기록해. push/master 병합은 별도 사용자 지시 없으면 하지 마.
```
