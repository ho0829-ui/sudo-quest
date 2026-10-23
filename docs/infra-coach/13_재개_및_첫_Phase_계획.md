# SUDO QUEST 재개 및 첫 Phase 계획

작성일: 2026-10-22 · 상태: **사용자 승인 후 첫 Phase 완료, 아래는 승인 당시 계획과 실제 결과**

## 실행 결과

- 사용자 "진행해줘"로 K8s 첫 Phase와 게시판 FastAPI+SQLite 선택 승인. 이번 Phase는 K8s 1개(14개) 완성.
- 진행 중 사용자 요청으로 정답 경로 밖의 14개 시나리오 탐색 검증을 추가하고 발견 결함 수정. 상세는 `14_시나리오_탐색_점검.md`.
- typecheck·Vitest 480개·build 통과. 백엔드 unittest 40개 통과. 새 런타임 의존성·환경변수 변경 없음.
- 브라우저는 새 방 입장·조사·복구·원인 모달·모바일 검증. 기존 학습 기록을 보존하기 위해 정답 제출/리포트 UI 완주는 하지 않고 완료·재생·리포트 생성을 자동 테스트로 확인.
- 다음 Phase는 승인한 SQLite 게시판. 단계별 완료 후 멈추는 작업 규칙에 따라 아직 미구현. 저장 방식은 다시 물을 필요 없음.

## 재개 시 확인한 사실

- 브랜치 `feature/sudo-quest`, 시작 HEAD `06d716b` (GPT 인수인계 프롬프트). master보다 18커밋 앞섬.
- 시작 시 작업 트리 깨끗함. 이전 대화에 남아 있는 미커밋 서버실 UI보다 현재 저장소를 우선한다.
- 시나리오 13개, Docker/Kubernetes는 준비 중 분류. 커뮤니티실은 그림만 있고 게시판 API/화면 없음.
- 사용자 최신 요청: 다른 로컬 서버가 켜져 있으면 종료하고 재개. 첨부문에 있는 기존 프로세스 보존 지침보다 이 요청을 우선했다.

### 종료한 서버

- SUDO QUEST API: PID 53603, `127.0.0.1:8000`, SIGTERM 정상 종료.
- 별도 M-Check 프로젝트(`/Users/jaeho/Developer/M-Check-Project-main/server`): `server-api-1`(8080), `server-db-1`(3307)을 `docker stop --timeout 20`으로 종료. 컨테이너·볼륨 삭제 없음.
- 5173 Vite는 재개 시 이미 꺼져 있었다. 5173/8000/8080/3307 리스너가 없음을 재확인했다.
- Raycast, macOS ControlCenter/rapportd, OrbStack 자체와 앱 보조 프로세스는 개발 서버가 아니므로 유지.
- 다음 구현 때 SUDO QUEST 서버만 다시 시작한다. 다른 프로젝트 서버를 자동 재시작하지 않는다.

### 이번 Mac에서 실행한 검사

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm test` | 16파일, 358개 통과 |
| `npm run build` | 통과, JS 507.29KB / gzip 164.78KB, 500KB 청크 경고 유지 |
| backend에서 `.venv/bin/python -m unittest discover -s tests` | 40개 OK |

이번 단계에서는 브라우저 검증·실제 제공자 호출·재색인·카탈로그 외부 링크 검증을 실행하지 않았다. `.env` 내용은 읽거나 변경하지 않았다.

## 추천하는 첫 Phase: Kubernetes 기반과 ImagePullBackOff 실습 1개

K8s 전체를 한꺼번에 만들기보다 첫 실습 하나를 처음부터 끝까지 완성한다. 그때 만든 상태 모델과 명령을 다음 CrashLoopBackOff/OOMKilled 실습에 확장한다. 목표는 **13 → 14개**, 쿠버네티스 운영실을 실제 입장 가능한 방으로 여는 것이다.

### 추가·변경 파일

새 파일(이름은 구현 중 책임에 맞춰 조정, 각 파일 200줄 이내):

- `src/engine/state/kubernetes/types.ts`: 클러스터·노드·이미지·Deployment·Pod·Service·이벤트 타입.
- `src/engine/state/kubernetes/reconcile.ts`: 템플릿과 사용 가능한 이미지에서 파드 상태/이벤트 계산.
- `src/engine/state/hosts/kubernetesAdmin.ts`: 정상 클러스터가 있는 운영용 호스트.
- `src/engine/commands/kubectl.ts`: 명령 진입점, 하위 명령/옵션 검증, operations 목록.
- `src/engine/commands/kubectl/queries.ts`, `mutations.ts`: 조회·변경 책임 분리.
- `src/scenarios/kubernetes-image-pull.ts`: 이미지 참조 문제를 조사·복구하는 시나리오.
- `tests/kubernetes.test.ts`, `tests/kubectl.test.ts`: 상태 변화와 명령 출력 회귀 검사.

기존 파일:

- `src/engine/state/types.ts`: `kubernetes?: KubernetesState` 추가.
- `src/engine/state/hosts/index.ts`: 정상 프리셋 등록.
- `src/engine/commands/index.ts`: kubectl 등록 및 코치의 하위 명령 목록 제공.
- `src/scenarios/index.ts`: 새 실습 추가.
- `src/ui/categories.ts`: 첫 K8s 실습 등록과 함께 comingSoon 해제.
- 필요 시 `src/engine/complete.ts`: 하위 명령 자동완성.
- 기존 시나리오/캠퍼스/명령 커버리지/코치 유출 테스트: 새 분류·호스트에 대한 가정 확인.

### 상태 타입 초안

```ts
interface KubernetesState {
  nodes: KubeNode[];
  images: Record<string, ImageProfile>;
  deployments: KubeDeployment[];
  pods: KubePod[];
  services: KubeService[];
  events: KubeEvent[];
}

interface PodTemplate {
  labels: Record<string, string>;
  containers: ContainerSpec[];
}

interface ContainerSpec {
  name: string;
  image: string;
  command?: string[];
  env: Record<string, string>;
  resources: { limits?: { memoryMiB?: number } };
  readinessProbe?: { path: string; port: number };
}
```

Deployment는 replicas/template/revision, Pod는 소속 Deployment·컨테이너 state/lastState·ready·restartCount를 가진다. ImageProfile은 사용 가능한 이미지와 실행 특성을 정의한다. 표시 문자열을 시나리오별로 저장하지 않고 템플릿 변경 뒤 공통 상태 계산으로 갱신한다. 서비스 엔드포인트는 selector에 맞는 Ready 파드로 계산한다. 메모리/이전 종료 상태 타입은 후속 Phase와 연결하되, 아직 지원하지 않는 동작을 구현한 것처럼 노출하지 않는다.

### 이 Phase에서 열 명령

- `kubectl get pods|deploy|svc|endpoints|events`와 해당 범위의 `-o wide`
- `kubectl describe pod|deploy`
- `kubectl set image deployment/이름 컨테이너=이미지`
- `kubectl rollout status deployment/이름`

`logs --previous`, `rollout undo`, `set resources`, `delete pod`는 다음 K8s Phase에서 필요한 동작과 함께 추가한다. 미지원 명령·옵션은 명시적으로 거절하고 command_operations에도 노출하지 않는다. 실제 시스템의 kubectl이나 Docker를 게임에서 호출하지 않는다.

### 완료 기준·검사

1. 이미지 참조를 깨뜨린 초기 상태에서 미복구이며, 조회/이벤트가 조사 단서를 제공.
2. 정상 이미지로 바꾸면 파드 상태·Ready 수·서비스 엔드포인트·rollout 출력이 상태에서 함께 바뀜.
3. 알 수 없는 이미지·리소스·옵션과 불완전한 인자 처리. 잘못된 명령은 상태를 바꾸지 않음.
4. 원본 SystemState 불변성 유지, 복제된 파드·이벤트 중복 누적 방지.
5. 시나리오 자동 검증, 근거 링크 검증, 명령 커버리지, 코치 요청 정답/근거 유출 검사 통과.
6. typecheck/전체 Vitest/build, 실제 브라우저에서 캠퍼스 입장 → 조사 → 조치 → 원인 제출 → 리포트 완주.
7. 공식 Kubernetes 문서를 직접 열어 상태·명령 형식을 확인하고 evidence에 넣음. 지금은 링크 검증 미실행.
8. 한국어 메시지로 의미 단위 커밋, push/병합 없음. HANDOFF/TASKS 갱신 후 멈춤.

## 이후 순서

1. K8s 후속: CrashLoopBackOff + OOMKilled, logs/previous·rollback·resources 변경 구현. 총 16개.
2. Docker 2개: 포트 충돌·즉시 종료. 컨테이너/이미지 상태와 명령 구현. 총 18개.
3. Linux/Web 3개: 업스트림 다운·inode 고갈·파일 디스크립터 고갈. 총 21개.
4. 추가 후보는 구현 난도와 사용자 피드백으로 결정. 위 순서/개수는 제안이지 승인된 완료 목록이 아님.

## 게시판 저장 방식 — FastAPI + SQLite 선택 승인됨

**추천: FastAPI + SQLite**. 이미 있는 Python 서버와 표준 sqlite3를 사용하고 `backend/data/community.sqlite3`에 저장한다. 외부 서비스나 프런트 런타임 의존성 추가가 없다. 정적 GitHub Pages 단독 배포에서는 연결 안 됨 안내가 필요하다.

대안: GitHub Discussions 연동. 자체 데이터베이스 운영은 줄지만 GitHub 로그인·외부 스크립트와 서비스 의존성이 생긴다.

SQLite를 선택하면 첫 범위는 익명 닉네임·분류·글 작성/목록/상세·댓글, 페이지네이션, 작성 속도 제한, 관리자만 삭제로 제안한다. 관리자 비밀은 서버 환경에만 두며 브라우저에 내장하지 않는다. 본문은 텍스트로 렌더링하고, API는 길이 제한/extra forbid/CORS/삭제 권한을 검증한다. `#/community`와 캠퍼스 커뮤니티실을 연결하며 서버가 꺼져도 게임은 정상 동작해야 한다.

이하의 대안 설명은 승인 전 비교 기록이다. 현재 결정은 FastAPI+SQLite이며 실제 게시판 구현은 다음 Phase에 진행한다.
