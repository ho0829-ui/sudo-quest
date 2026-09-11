# 장애 대응 트러블슈팅 게임 — Claude Code 프로젝트 프롬프트

## 0. 너에게 부탁하는 방식 (가장 먼저 읽어줘)

나는 IT 인프라/클라우드 엔지니어를 준비하는 학생이야. **게임을 만들어 본 적이 없고, 시스템 장애 지식도 아직 많지 않아.** 이 프로젝트는 결과물만큼이나 **내가 코드를 읽고 이해하는 과정**이 중요해.

- 코드를 한꺼번에 많이 만들지 말고, **아래 Phase 단위로 나눠서** 진행해줘.
- 각 Phase를 시작하기 전에 **무엇을 만들지 계획을 먼저 보여주고**, 끝나면 **만든 파일 구조와 핵심 흐름을 짧게 설명**한 뒤 멈춰줘. 내가 확인하고 "다음"이라고 하면 넘어가자.
- 코드는 **짧고 읽기 쉽게**, 복잡한 부분에는 **한국어 주석**을 달아줘. 영리한 한 줄보다 명확한 세 줄이 좋아.
- 기술 선택이나 설계에서 트레이드오프가 있으면 **왜 그렇게 골랐는지** 한두 문장으로 알려줘.
- 이 문서의 핵심 규칙(아키텍처 원칙, 시나리오 규칙, 작업 방식)은 프로젝트 루트의 `CLAUDE.md`로 정리해서 이후에도 지켜줘.
- Phase가 끝날 때마다 의미 있는 단위로 git commit 해줘.

---

## 1. 프로젝트 개요

**한 줄 요약:** 브라우저 안의 가상 터미널에서 명령어를 입력하며, 일부러 망가뜨려진 가상 서버의 장애 원인을 찾고 복구하는 **트러블슈팅 학습 게임**.

**핵심 원칙:**
- **완전한 시뮬레이션.** 실제 명령어를 실행하거나 실제 시스템에 접근하는 코드는 절대 없어야 해. 모든 것은 메모리 안의 가상 상태야.
- **실제와 최대한 비슷하게.** 명령어 출력 형식은 실제 리눅스/AWS CLI 출력과 비슷해야 해. 여기서 익힌 감각이 실제 서버에서도 통해야 하니까.
- **정답을 알려주는 게임이 아니라 사고 과정을 훈련하는 게임.** 증상 확인 → 범위 좁히기 → 가설 → 검증 → 조치 → 재발 방지의 흐름을 자연스럽게 익히게 해줘.

**사용 목적 (셋 다 만족해야 해):**
1. 나 혼자 공부용
2. 스터디원에게 **링크 하나로 공유** (설치 없이 브라우저에서 바로 플레이)
3. GitHub **포트폴리오** (README, 코드 구조, 테스트 품질이 중요)

---

## 2. 기술 스택

- **Vite + React + TypeScript**
- **Vitest** (테스트)
- **정적 사이트로 빌드 → GitHub Pages 배포** (GitHub Actions). 서버, DB, API 키 없음.
- 진행 상황 저장은 `localStorage` (try/catch로 감싸고, 실패해도 게임은 정상 동작)
- 외부 라이브러리는 최소화. 추가가 필요하면 이유를 말하고 물어봐줘.

더 적합한 선택이 있다고 판단되면 Phase 0에서 제안해줘.

---

## 3. 아키텍처 원칙 (중요)

### 3-1. 엔진, 콘텐츠, UI를 분리
```
src/
  engine/        # 순수 TypeScript. React를 전혀 모름. 테스트 대상의 핵심.
    state/       # 가상 시스템 상태 모델 (파일시스템, 서비스, 프로세스, 디스크, 네트워크, AWS 리소스)
    commands/    # 명령어 구현. 각 명령어 = 상태를 읽거나 바꾸는 함수
    parser/      # 입력 문자열 → 명령어 + 인자 파싱
    judge/       # 복구 여부 판정 (상태 기반 검사)
  scenarios/     # 시나리오 데이터 파일 (코드가 아니라 데이터)
  ui/            # React 컴포넌트 (터미널, 티켓, 힌트, 결과 리포트 등)
```

### 3-2. 명령어 출력은 "상태에서 계산"
- 시나리오마다 명령어 출력을 하드코딩하지 말아줘.
- 시나리오는 **초기 시스템 상태 + 장애 주입(fault)**을 정의하고, `df -h`, `systemctl status` 같은 명령어는 **현재 상태를 읽어서 출력을 만들어**.
- 그래야 플레이어가 조치 명령(예: 로그 삭제, 서비스 재시작)을 실행하면 상태가 바뀌고, 이후 명령어 결과도 일관되게 바뀌어.
- 정말 특수한 출력만 시나리오에서 오버라이드할 수 있게 해줘.

### 3-3. 시나리오는 데이터 파일로
새 시나리오를 추가할 때 **엔진 코드를 고치지 않고 파일 하나만 추가**하면 되게 해줘. 스터디원도 기여할 수 있어야 해.

### 3-4. 시나리오 스키마 (초안, 개선 제안 환영)
```ts
interface Scenario {
  id: string;                  // "linux-disk-full"
  title: string;               // "웹사이트가 갑자기 안 열려요"
  category: "linux" | "network" | "web-db" | "aws";
  difficulty: 1 | 2 | 3;       // 초급/중급/고급
  ticket: string;              // 고객이나 동료가 보낸 장애 신고 (증상만, 원인은 절대 노출 X)
  learningObjectives: string[];
  initialState: SystemState;   // 정상 상태 + 장애가 주입된 상태
  rootCause: {
    id: string;
    choices: string[];         // 원인 제출용 보기 (그럴듯한 오답 포함)
    answer: string;
  };
  resolution: (state: SystemState) => boolean;  // 상태 기반 복구 판정
  hints: [string, string, string];  // 3단계 힌트 (아래 참고)
  solutionPath: string[];      // 모범 풀이 명령어 순서 (테스트에서 사용)
  postmortem: {
    whatHappened: string;
    whyItHappened: string;
    howToFix: string;
    howToPrevent: string;      // 모니터링, 알림, 자동화 등 재발 방지책
    realWorldNote?: string;    // 실무에서 이 장애가 어떤 모습으로 나타나는지
  };
}
```

---

## 4. 게임 흐름

1. **시나리오 선택 화면**: 카테고리/난이도별 목록, 클리어 여부 표시
2. **장애 티켓 화면**: 증상만 보여줘. ("오전 9시부터 웹사이트 접속이 안 된다는 문의가 들어오고 있어요")
3. **조사 (메인 화면)**
   - 왼쪽: 가상 터미널 (명령어 입력, 방향키 히스토리, Tab 자동완성은 있으면 좋음)
   - 오른쪽: 티켓 요약, 내가 입력한 명령어 기록, 힌트 버튼, 원인 제출 버튼
   - `help`: 이 시나리오에서 쓸 수 있는 명령어 목록과 짧은 설명
   - 지원하지 않는 명령어는 실제 셸처럼 `command not found`
4. **원인 제출**: 보기 중에서 선택 (틀리면 감점, 다시 조사 가능)
5. **복구 조치**: 터미널에서 실제로 고치는 명령 실행 → `resolution` 판정 통과 시 클리어
6. **결과 리포트 (포스트모템)**
   - 무슨 일이 있었고, 왜 생겼고, 어떻게 고치고, 어떻게 예방하는지
   - **내가 입력한 명령어 vs 모범 풀이 비교**
   - 점수: 소요 시간, 명령어 수, 힌트 사용 수, 오답 수

### 힌트는 3단계 (정답을 바로 주지 않기)
- **1단계 — 방향 질문**: "서비스가 왜 멈췄는지 기록을 남기는 곳이 있지 않을까요?"
- **2단계 — 볼 곳 제시**: "서비스 상태와 로그를 확인해보세요. `systemctl`과 `journalctl`이 도움이 돼요."
- **3단계 — 거의 정답**: "로그에 `No space left on device`가 보이네요. 디스크 사용량을 확인해볼까요?"

---

## 5. 시나리오 목록

아래는 초안이야. 기술적으로 부정확하거나 더 좋은 교육용 시나리오가 있으면 수정 제안해줘.

| ID | 카테고리 | 난이도 | 증상 | 실제 원인 | 핵심 명령어 |
|---|---|---|---|---|---|
| linux-disk-full | 리눅스 | 1 | 웹사이트 접속 불가 | 로그 폭증으로 디스크 100% | `systemctl status`, `journalctl`, `df -h`, `du -sh`, `rm`/`truncate` |
| linux-permission | 리눅스 | 1 | 페이지가 403 Forbidden | 웹 루트 파일 권한/소유자 오류 | `ls -l`, `chmod`, `chown`, `tail` (error.log) |
| linux-oom | 리눅스 | 2 | 앱이 주기적으로 죽음 | 메모리 부족으로 OOM Killer 발동 | `free -m`, `ps aux`, `dmesg`, `journalctl` |
| linux-port-conflict | 리눅스 | 2 | 서비스 재시작 실패 | 다른 프로세스가 포트 점유 | `systemctl status`, `ss -tlnp`, `kill` |
| network-dns | 네트워크 | 1 | 외부 API 호출 실패 | `/etc/resolv.conf` 잘못된 네임서버 | `ping`, `curl`, `dig`, `cat /etc/resolv.conf` |
| network-firewall | 네트워크 | 1 | 외부에서만 접속 불가 | 방화벽이 80/443 차단 | `curl localhost`, `ufw status`, `ufw allow` |
| network-bind-localhost | 네트워크 | 2 | 서버 안에선 되고 밖에선 안 됨 | 앱이 127.0.0.1에만 바인딩 | `ss -tlnp`, `cat` (앱 설정) |
| web-nginx-config | 웹/DB | 1 | 설정 변경 후 사이트 다운 | nginx 설정 문법 오류 | `nginx -t`, `cat`, 설정 수정, `systemctl restart` |
| web-ssl-expired | 웹/DB | 2 | 브라우저 보안 경고 | SSL 인증서 만료 | `curl -v`, `openssl x509 -enddate` |
| db-max-connections | 웹/DB | 3 | 트래픽 몰릴 때만 500 에러 | DB 최대 연결 수 초과 | 앱 로그, `mysql` 상태 조회 |
| aws-security-group | AWS | 1 | 새 EC2에 접속 불가 | 보안그룹 인바운드 규칙 누락 | `aws ec2 describe-instances`, `describe-security-groups`, `authorize-security-group-ingress` |
| aws-alb-healthcheck | AWS | 2 | ALB가 503 반환 | 헬스체크 경로 오류로 타깃 unhealthy | `aws elbv2 describe-target-health`, `describe-target-groups`, `modify-target-group` |
| aws-iam-s3 | AWS | 2 | 앱이 S3 업로드 실패 | EC2 IAM 역할에 권한 없음 | 앱 로그(AccessDenied), `aws sts get-caller-identity`, `aws iam` 조회 |

**시나리오 품질 규칙:**
- 티켓에 원인을 직접 노출하지 않기
- 원인을 찾는 데 필요한 **단서가 명령어 출력 안에 반드시 존재**해야 함
- 오답 보기는 **실제로 헷갈릴 만한 것**으로 (예: 디스크 문제인데 "메모리 부족", "DNS 오류")
- 원인과 무관한 정상 로그/출력도 섞어서 현실감 주기

---

## 6. 테스트 (포트폴리오 핵심)

- **모든 시나리오 자동 검증 테스트**: 각 시나리오의 `solutionPath`를 엔진에 순서대로 실행했을 때 `resolution`이 `true`가 되는지 검사. **풀 수 없는 시나리오는 CI에서 실패**해야 해.
- 장애 주입 직후에는 `resolution`이 `false`인지도 검사
- 명령어 파서, 주요 명령어 출력 단위 테스트
- 시나리오 데이터 스키마 검증

---

## 7. 개발 단계 (Phase마다 멈추고 설명해줘)

**Phase 0 — 설계 확인**
- 이 문서를 읽고 폴더 구조, 상태 모델 타입, 시나리오 스키마를 제안
- 기술적으로 이상한 부분이나 더 좋은 대안이 있으면 지적
- `CLAUDE.md` 작성

**Phase 1 — 엔진 최소 구현 (UI 없음)**
- 상태 모델, 파서, 명령어 약 8개, 판정 로직
- 시나리오 1개(`linux-disk-full`)
- Vitest로 `solutionPath` 테스트 통과

**Phase 2 — 게임 루프 UI**
- 시나리오 선택 → 티켓 → 터미널 조사 → 원인 제출 → 복구 → 결과 리포트
- 힌트 3단계, 점수, `localStorage` 진행 저장
- 이 시점에서 처음부터 끝까지 플레이 가능해야 해

**Phase 3 — 카테고리별 대표 시나리오 확장**
- `network-firewall`, `web-nginx-config`, `aws-security-group` 추가
- 엔진 수정 없이 추가되는지 확인 (필요하면 엔진을 일반화)

**Phase 4 — 나머지 시나리오 추가**
- 표의 나머지 시나리오를 난이도 순으로 추가

**Phase 5 — 배포와 포트폴리오 정리**
- GitHub Actions: 테스트 → 빌드 → GitHub Pages 배포
- `README.md` (한국어): 프로젝트 소개, 플레이 링크, 스크린샷/GIF 자리, **아키텍처 다이어그램 (Mermaid)**, 설계 결정과 이유, 기술 스택, 로컬 실행 방법
- `docs/SCENARIO_GUIDE.md`: 스터디원이 시나리오를 추가하는 방법 (템플릿 포함)

---

## 8. 나중에 할 것 (지금은 만들지 마)
- 게임 중 AI가 소크라테스식 힌트를 주는 기능 (LLM API)
- 실제 Docker 컨테이너 실습 모드
- 모니터링 대시보드 화면 (CPU/메모리/에러율 그래프로 단서 제공)
- 여러 장애가 동시에 발생하는 복합 시나리오

단, 이런 확장이 나중에 가능하도록 **엔진 구조를 너무 좁게 만들지는 말아줘.**

---

준비됐으면 **Phase 0**부터 시작해줘.
