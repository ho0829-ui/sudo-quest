# 시나리오 추가 가이드

새 시나리오를 만드는 건 **파일 하나를 추가하는 일**입니다. 엔진 코드는 건드리지 않습니다.

---

## 3단계로 끝내기

### 1. 파일 만들기

`src/scenarios/` 에 `<카테고리>-<주제>.ts` 형식으로 만듭니다. (예: `linux-inode-full.ts`)
아래 [템플릿](#템플릿)을 복사해서 채우세요. 템플릿은 그대로도 테스트를 통과합니다.

### 2. 목록에 등록하기

`src/scenarios/index.ts` 에 두 줄 추가합니다. (아래는 `linux-inode-full.ts` 안에서
`linuxInodeFull` 이라는 이름으로 export 했을 때의 예입니다)

```ts
import { linuxInodeFull } from "./linux-inode-full";   // ← 추가

export const scenarios: Scenario[] = [
  // ...
  linuxInodeFull,                                       // ← 추가
];
```

### 3. 테스트 돌리기

```bash
npm test
```

**따로 테스트를 쓸 필요가 없습니다.** 등록하는 순간 자동 검증 대상이 됩니다.
통과하면 끝입니다. 실패하면 아래 [문제 해결](#문제-해결)을 보세요.

---

## 시나리오는 어떻게 생겼나

시나리오는 **코드가 아니라 데이터**입니다. "정상 서버에서 출발해 무엇을 망가뜨릴지"만 적습니다.

```
정상 프리셋 (host)  +  장애 주입 (faults)  =  플레이어가 마주하는 상태
```

명령어 출력은 **적지 않습니다.** `df -h` 결과는 엔진이 그때의 상태를 보고 계산합니다.
그래서 플레이어가 파일을 지우면 출력이 저절로 바뀝니다.

> ⚠️ 출력을 직접 적고 싶어지면, 대개 **상태 모델이 부족한 것**입니다. 이슈로 알려주세요.

---

## 템플릿

```ts
import { withCommands } from "../engine/commands";
import { all, diskUsageBelow, serviceIsActive } from "../engine/judge";
import { crashService, logLine, putFile } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

export const myScenario: Scenario = {
  id: "my-scenario",                   // 파일명과 같게
  title: "사이트가 안 열린다고 합니다",    // 증상을 신고자 말투로
  category: "linux",                   // linux | network | web-db | aws (engine/scenario/categories.ts)
  difficulty: 1,                       // 1 초급 | 2 중급 | 3 고급

  // 장애 티켓: 증상만! 원인을 절대 노출하지 않는다
  ticket: [
    "오전 9시쯤부터 사이트 접속이 안 된다는 문의가 들어오고 있습니다.",
    "저희 쪽에서 바꾼 건 없습니다. 확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "이 시나리오로 무엇을 배우게 할지 1~3개",
  ],

  host: "ubuntu-web",                  // ubuntu-web | aws-admin
  commands: withCommands("curl", "ss"), // 기본 묶음 + 이 시나리오에서 쓸 명령어

  // 무엇을 망가뜨릴지
  faults: [
    putFile("/var/log/app/huge.log", { sizeKB: 6_150_000 }),
    crashService("nginx", "No space left on device", { agoMs: 900_000 }),
    logLine("nginx", "결정적 단서가 되는 로그 한 줄", {
      unit: "nginx",                   // journalctl -u nginx 로 걸러지게
      priority: "err",
      offsetMs: -900_000,              // 15분 전
    }),
    // 원인과 무관한 정상 로그도 섞어주면 현실감이 생긴다
    logLine("CRON", "(root) CMD (/usr/local/bin/backup.sh)", { offsetMs: -3_000_000 }),
  ],

  rootCause: {
    answerId: "the-real-cause",
    choices: [
      { id: "the-real-cause", label: "실제 원인을 한 문장으로" },
      {
        id: "plausible-1",
        label: "헷갈릴 만한 오답 1",
        whyWrong: "왜 이건 원인이 아닌지. 어떤 출력을 보면 배제할 수 있는지 알려준다.",
      },
      {
        id: "plausible-2",
        label: "헷갈릴 만한 오답 2",
        whyWrong: "여기도 마찬가지로 배제 근거를 적는다.",
      },
    ],
  },

  // 3단계 힌트: 정답을 바로 주지 않는다
  hints: [
    "방향 질문 — \"서비스가 왜 멈췄는지 기록을 남기는 곳이 있지 않을까요?\"",
    "볼 곳 제시 — \"`systemctl` 과 `journalctl` 이 도움이 돼요.\"",
    "거의 정답 — \"로그에 `No space left on device` 가 보이네요.\"",
  ],

  // 복구 판정: 무엇이 참이어야 클리어인가
  resolution: all(diskUsageBelow("/", 90), serviceIsActive("nginx")),

  // 모범 풀이. 테스트가 이대로 실행해서 resolution이 true가 되는지 검증한다
  solutionPath: [
    "systemctl status nginx",
    "journalctl -u nginx -n 20",
    "df -h",
    "sudo rm /var/log/app/huge.log",
    "sudo systemctl restart nginx",
  ],

  postmortem: {
    whatHappened: "무슨 일이 있었나 (기술적으로 정확하게)",
    whyItHappened: "왜 생겼나 (사람과 프로세스의 문제까지)",
    howToFix: "어떻게 고쳤나",
    howToPrevent: [
      "1) 모니터링/알림으로 어떻게 미리 잡을까",
      "2) 자동화나 설정으로 어떻게 막을까",
      "3) 프로세스를 어떻게 바꿀까",
    ].join("\n"),
    realWorldNote: "실무에서 이 장애가 어떤 모습으로 나타나는지 (선택)",
  },

  // 실제로 일어나는 장애라는 근거. 클리어 뒤 리포트의 "참고 자료"에만 보인다.
  evidence: [
    { kind: "official-doc", title: "write(2) — ENOSPC", url: "https://man7.org/linux/man-pages/man2/write.2.html" },
  ],
};
```

### 근거 자료 (`evidence`)

"이 장애가 실제로 자주 일어나는가"를 데이터로 남깁니다. 테스트가 아래를 강제합니다.

| 규칙 | 이유 |
|---|---|
| 1개 이상, 주소는 `https://` | 출처 없는 시나리오가 들어오지 않게 |
| `official-doc`(공식 문서)나 `postmortem`(공개 포스트모템)이 하나 이상 | 3자 블로그·설문만으로는 근거가 약하다. `survey`(업계 조사)는 덧붙이는 용도 |
| 브리핑·코치 요청에는 넣지 않는다 | 제목에 원인이 드러난다(예: "bind(2) — EADDRINUSE"). 리포트에서만 보여 준다 |

링크는 넣기 전에 직접 열어 보고, 오류 문구·설정 이름이 실제로 그 페이지에 있는지 확인하세요.

---

## 재료 목록

### 장애 주입 (`engine/state/faults.ts`)

| 헬퍼 | 하는 일 |
|---|---|
| `putFile(경로, { sizeKB, content, owner, mode })` | 파일을 만들거나 덮어쓴다 |
| `crashService(이름, 사유, { agoMs })` | 서비스를 죽은 상태로 만든다 |
| `logLine(태그, 메시지, { unit, priority, offsetMs, pid })` | 과거 로그를 남긴다 |
| `restartedAt(서비스, agoMs)` | 과거에 재시작된 것으로 만든다 (설정 변경과 짝) |
| `setClock(시각)` | 시뮬레이션 시각을 옮긴다 |

이걸로 안 되면 함수를 직접 써도 됩니다. `Fault` 는 그냥 `(state) => void` 입니다.

```ts
const breakSomething: Fault = (state) => {
  state.network.firewall.rules = state.network.firewall.rules.filter((r) => r.port !== 80);
};
```

### 복구 판정 (`engine/judge/index.ts`)

| 헬퍼 | 참이 되는 조건 |
|---|---|
| `all(...)` / `any(...)` / `not(...)` | 조건 조합 |
| `serviceIsActive("nginx")` | 서비스가 떠 있다 |
| `diskUsageBelow("/", 90)` | 디스크 사용률이 90% 미만 |
| `memoryUsageBelow(85)` | 메모리 사용률이 85% 미만 |
| `httpResponds("localhost", 80)` | HTTP 200이 온다 (403·502는 실패로 본다) |
| `firewallAllows(80)` | 외부에서 그 포트로 들어올 수 있다 |
| `portIsListening("0.0.0.0", 3000)` | 정확히 그 주소:포트에서 듣고 있다 |
| `nginxConfigIsValid()` | nginx 설정 문법이 올바르다 |
| `fileExists(경로)` / `fileContains(경로, 문자열)` | 파일이 있다 / 특정 내용을 담고 있다 |
| `fileSizeBelowKB(경로, 크기)` | 파일이 그 크기 미만이다 (지워졌으면 통과) |
| `securityGroupAllows("sg-…", 22)` | 보안그룹이 그 포트를 연다 |
| `targetGroupIsHealthy("arn:…")` | ALB 타깃이 정상이다 |
| `iamRoleHasPolicy("역할", "정책")` | IAM 역할에 정책이 붙어 있다 |

### 쓸 수 있는 명령어

`withCommands(...)` 로 기본 묶음에 더합니다. 기본 묶음(생략 시)은
`help ls cat cd pwd tail head grep sort wc df du rm systemctl journalctl` 입니다.
파이프(`journalctl -u nginx | grep error | wc -l`)도 됩니다.

티켓·힌트·모범 풀이에 적은 명령은 **그 시나리오에서 실제로 실행돼야** 합니다.
`tests/command-coverage.test.ts` 가 "지원하지 않는 옵션"으로 끝나는 명령을 잡아냅니다.

| 분야 | 명령어 |
|---|---|
| 파일 | `ls` `cat` `cd` `pwd` `tail` `head` `grep`(-A/-B/-C 문맥 포함) `sort` `wc` `rm` `sed` `chmod` `chown` |
| 시스템 | `df` `du` `free` `ps` `dmesg` `kill` `systemctl` `journalctl` |
| 네트워크 | `curl` `ss` `ufw` `ping` `dig` |
| 웹/DB | `nginx` `openssl` `certbot` `mysql` |
| AWS | `aws` (ec2 · elbv2 · iam · sts) |
| Kubernetes | `kubectl get` (pods/deploy/svc/endpoints/events/nodes, 이름·별칭·wide), `describe pod/deploy`, `logs`(-c, -p/--previous, --tail, deploy/NAME), `set image` · `set env`(--list, KEY-) · `set resources`(--limits/--requests), `rollout status` · `history` · `undo`(--to-revision) |

### 호스트 프리셋

| 이름 | 설명 |
|---|---|
| `ubuntu-web` | nginx + shop-api가 도는 웹 서버 (web-01). 대부분 여기서 시작 |
| `aws-admin` | AWS CLI가 있는 운영 작업 서버 (ops-bastion). 클라우드 시나리오용 |

---

## 좋은 시나리오의 조건

체크리스트로 확인하세요. 자동 검증 테스트가 일부는 강제합니다.

- [ ] **티켓에 원인이 없다.** 증상만 적혀 있다.
- [ ] **단서가 출력 안에 반드시 있다.** 로그 한 줄, 설정 한 줄이라도.
- [ ] **오답이 진짜 헷갈린다.** "디스크 문제인데 메모리 부족" 정도로 그럴듯하게.
- [ ] **오답마다 `whyWrong` 이 있다.** 어떤 출력을 보면 배제할 수 있는지 알려준다.
- [ ] **원인과 무관한 정상 로그도 섞여 있다.** 실제 서버 로그는 깨끗하지 않다.
- [ ] **힌트 1단계가 정답을 말하지 않는다.** 질문을 던진다.
- [ ] **포스트모템의 `howToPrevent` 가 구체적이다.** "잘 관리한다" ✕ / "80%에서 경고 알림" ○
- [ ] **`evidence` 에 공식 문서나 공개 포스트모템이 있다.** 링크를 직접 열어 확인했다.

### 티켓 쓰는 요령

신고자는 엔지니어가 아닐 수도 있습니다. **그 사람이 실제로 쓸 법한 말투**로 쓰세요.

| ✕ 이렇게 말고 | ○ 이렇게 |
|---|---|
| "nginx가 SIGTERM으로 종료되었습니다" | "사이트가 안 열린다는 문의가 들어오고 있어요" |
| "디스크 사용률이 100%입니다" | "오전 9시쯤부터 갑자기 안 됩니다" |

그리고 **잘못된 단서를 하나쯤 섞어도 좋습니다.** ("방화벽은 이미 확인했습니다") 실무에서도 그렇습니다.

---

## 문제 해결

### `장애 주입 직후에는 복구되지 않은 상태다` 실패

장애를 넣었는데도 `resolution` 이 처음부터 `true` 입니다.

- 판정 조건이 너무 느슨하지 않은지 보세요. (예: 연결만 확인하고 상태 코드는 안 봄)
- `faults` 가 실제로 상태를 바꾸고 있는지 확인하세요.

### `모범 풀이대로 하면 복구된다` 실패

`solutionPath` 를 다 실행해도 `resolution` 이 `false` 입니다.

- 조치 명령을 빠뜨리지 않았나요? 원인을 없앤 뒤 **서비스 재시작**이 필요한 경우가 많습니다.
- 설정 파일을 고쳤다면 **재시작**을 넣었나요? 파일만 고치면 돌고 있는 프로세스는 그대로입니다.
- `sudo` 를 빠뜨리지 않았나요? 권한이 필요한 명령은 실제처럼 막힙니다.

### `모범 풀이의 결과에 "…" 가 있습니다` 실패

`solutionPath` 의 명령이 실패 신호를 냈습니다. 경로 오타이거나, `commands` 화이트리스트에 그 명령어를 안 넣었을 가능성이 높습니다.

### 출력을 직접 확인하고 싶을 때

임시 테스트 파일을 만들어 눈으로 보세요. 다 보고 나면 지우면 됩니다.

```ts
// tests/_play.test.ts
import { it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { myScenario as s } from "../src/scenarios/my-scenario";

it("플레이 화면 확인", () => {
  let state = buildInitialState(s);
  for (const input of s.solutionPath) {
    const r = runCommand(state, input, { available: s.commands });
    state = r.state;
    console.log(`$ ${input}`);
    if (r.stdout) console.log(r.stdout);
    if (r.stderr) console.log(r.stderr);
  }
});
```

```bash
npx vitest run tests/_play.test.ts
```

---

## 새 분류(운영실) 추가

도커·쿠버네티스처럼 **분류 자체가 새로 생길 때**만 필요합니다. 기존 분류에 문제를 더할 때는 위 3단계로 충분합니다.

### 이미 방이 지어진 분류: Docker·Kubernetes

`docker`(컨테이너 운영실)는 캠퍼스에 방을 먼저 지어 둔 **준비 중** 분류입니다. `kubernetes`는 이미지 풀 실패·CrashLoopBackOff·OOMKilled 실습 3개가 있습니다.
`category: "docker"` 시나리오를 처음 넣을 때 `src/ui/categories.ts` 에서 그 분류의 `comingSoon: true` 를 지우면
목록 탭·레일·관제실 화면·경보등이 함께 열립니다. 둘 중 하나만 하면 `tests/campus.test.ts` 가 실패해 알려 줍니다.

### 완전히 새 분류

1. `src/engine/scenario/categories.ts` 의 `CATEGORY_IDS` 에 id를 더한다.
2. `npm run typecheck` 를 돌리면 **빠진 곳이 컴파일 오류로 나온다.** 그 세 곳을 채운다.
   - `src/ui/categories.ts` — 이름·태그·운영실 이름("○○ 운영실")·설명·아이콘·캠퍼스 칸(`slot`)
   - `src/ui/campus/themes.ts` — 네온 색(화면에서 이웃한 방과 색상이 겹치지 않게)과 바닥·벽 색
   - `src/ui/campus/art/RoomArt.tsx` — 방 안 그림 컴포넌트(`art/` 에 새 파일)
3. 지금 3×3 격자는 방 9개로 꽉 찼다. 새 칸을 쓰려면 `GRID_SIZE` 를 늘리고 바깥 칸(예: `[3,0]`)을 준다.
   문·복도·지도 크기·관제실 미니맵은 `src/ui/campus/layout.ts` 가 칸에서 계산하므로 손댈 필요가 없다.
4. 시나리오를 1개 이상 넣거나, 아직 없으면 `comingSoon: true` 로 둔다.
5. `npm test` — `tests/campus.test.ts` 가 칸 중복·격자 밖·색 중복·복도 끊김·이름 규칙·준비 중 표시를 검사한다.

새 명령어(`docker`, `kubectl` 등)가 필요하면 엔진 작업이므로 시나리오와 따로 PR을 올려 주세요.

### Kubernetes 프리셋

`host: "kubernetes-admin"`과 `withCommands("kubectl")`을 사용합니다. 상태 타입은 `src/engine/state/kubernetes/types.ts`, 계산은 `reconcile.ts`입니다. Deployment를 새로 만들 때는 `state/kubernetes/history.ts`의 `addDeployment`(revision 1 기록 포함), 템플릿을 바꾸는 fault는 `changeTemplate(deployment, "변경 사유", template => …)`를 쓰고 `reconcileKubernetes(cluster, 시각)`을 호출합니다. `changeTemplate`이 revision과 `rollout history`를 함께 남기므로 `rollout undo`가 자동으로 대체 풀이가 됩니다. 서비스 엔드포인트는 selector와 Ready 파드에서 계산합니다.

컨테이너가 어떻게 끝나는지도 상태에서 계산합니다(`runtime.ts`의 `outcome`). 출력 문장을 시나리오에 적지 마세요.

| 상태 | 쓰는 곳 | 결과 |
|---|---|---|
| `images[이미지]` 없음 | — | ImagePullBackOff |
| 이미지 `requiredEnv`에 있는데 컨테이너 `env`에 없음 | `images[…].requiredEnv`, `containers[].env` | CrashLoopBackOff, Last State Error·종료 코드 1, 로그 마지막 줄 `FATAL config: required environment variable X is not set` |
| 이미지 `memoryMi` > 컨테이너 `resources.limits.memoryMi` | `images[…].memoryMi`, `containers[].resources` | CrashLoopBackOff, Last State OOMKilled·137, 로그는 `log.boot`에서 오류 없이 끊김 |
| 그 밖 | `images[…].log.boot`·`log.ready` | Running, 로그는 boot+ready |

재시작 횟수는 반복 종료가 시작된 시각과 시뮬레이션 시각으로 계산합니다(10초부터 두 배, 최대 300초 간격).

현재는 default 네임스페이스, Recreate 전략, 가상 이미지 목록, 즉시 상태 계산만 지원합니다. 실제 재시도 대기·RollingUpdate·ConfigMap/Secret 참조·인증·delete·`kubectl top`은 아직 없습니다. 후속 시나리오에 필요한 동작을 먼저 공통 엔진에 추가하세요.

새 시나리오는 `tests/scenario-exploration.cases.ts`에도 조회·무관한 조치·대체 풀이를 추가해야 합니다. `solutionPath`를 복사해 채우지 말고 실제 사용자가 시도할 다른 경로를 작성하세요.

---

## Pull Request 전 확인

```bash
npm test && npm run typecheck
```

둘 다 통과하면 PR을 올려주세요. CI에서도 같은 검사가 돌아갑니다.
