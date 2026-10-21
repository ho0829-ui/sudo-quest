import { describe, expect, it } from "vitest";
import { commandOperations, supportsInvocation } from "../src/engine/commands";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { ubuntuWeb } from "../src/engine/state/hosts";
import { kubernetesImagePull as scenario } from "../src/scenarios/kubernetes-image-pull";
import type { SystemState } from "../src/engine/state/types";
import { createSession, execute, isCleared, submitCause } from "../src/engine/session/session";
import { restoreSession, serializeSession } from "../src/ui/sessionStore";
import { buildReportMarkdown, EMPTY_REFLECTION } from "../src/ui/report";

const run = (line: string, state: SystemState = buildInitialState(scenario)) =>
  runCommand(state, line, { available: scenario.commands });
const repair = "kubectl set image deployment/shop-web web=registry.example.com/shop/web:1.4.2";

describe("kubectl 조사와 복구", () => {
  it("파드의 풀 실패와 정상 파드, 이벤트의 not found를 구분한다", () => {
    const pods = run("kubectl get pods -o wide");
    expect(pods.stdout).toContain("ImagePullBackOff");
    expect(pods.stdout).toContain("Running");
    expect(pods.stdout).toContain("worker-01");
    const details = run("kubectl describe pods").stdout;
    expect(details).toContain("Status:       Pending");
    expect(details).toContain("Restart Count:  0");
    expect(details).toContain("failed to resolve reference: not found");
    expect(run("kubectl get svc -o wide").stdout).toContain("app=shop-web");
    expect(run("kubectl get endpoints shop-web").stdout).toContain("<none>");
    expect(run("kubectl rollout status deployment/shop-web").exitCode).toBe(1);
  });

  it("복구는 원본 상태를 바꾸지 않고 rollout과 엔드포인트에 함께 반영된다", () => {
    const initial = buildInitialState(scenario);
    const snapshot = structuredClone(initial);
    const fixed = run(repair, initial);
    expect(fixed.exitCode).toBe(0);
    expect(initial).toEqual(snapshot);
    expect(scenario.resolution(initial)).toBe(false);
    expect(scenario.resolution(fixed.state)).toBe(true);
    expect(run("kubectl get deploy shop-web", fixed.state).stdout).toContain("2/2");
    expect(run("kubectl rollout status deployment/shop-web", fixed.state).stdout).toContain("successfully rolled out");
    expect(run("kubectl get endpoints shop-web", fixed.state).stdout).toContain("10.244.0.10:8080");
    expect(run(repair, fixed.state).state).toEqual(fixed.state);
  });

  it("존재하지 않는 이미지도 설정은 받아들이지만 배포 성공으로 오인하지 않는다", () => {
    const result = run("kubectl set image deploy/shop-web web=registry.example.com/shop/web:unknown");
    expect(result.exitCode).toBe(0);
    expect(scenario.resolution(result.state)).toBe(false);
    expect(run("kubectl describe pods", result.state).stdout).toContain("web:unknown");
    expect(run("kubectl rollout status deploy/shop-web", result.state).exitCode).toBe(1);
  });

  it("여러 컨테이너 갱신에서 뒤쪽 인자가 틀려도 앞쪽만 적용하지 않는다", () => {
    const state = buildInitialState(scenario);
    const result = run(`${repair} typo=other:1`, state);
    expect(result.exitCode).toBe(1);
    expect(result.state).toEqual(state);
  });

  it.each([
    "kubectl get pods --watch", "kubectl get pods -o json", "kubectl get pods -o", "kubectl get pods -o wide -o wide",
    "kubectl get secrets", "kubectl get pods missing", "kubectl get pods one two", "kubectl get pods/",
    "kubectl describe svc", "kubectl describe pod missing", "kubectl describe deploy missing",
    "kubectl logs shop-web", "kubectl rollout undo deployment/shop-web --to-revision=9", "kubectl rollout undo deploy/missing",
    "kubectl rollout status deployment/shop-web extra",
    "kubectl set image", "kubectl set image pod/shop-web web=image:1", "kubectl set image deploy/missing web=image:1",
    "kubectl set image deploy/shop-web web=", "kubectl set image deploy/shop-web web=a=b",
    "kubectl set image deploy/shop-web web=image:1 web=image:2", `${repair} --dry-run=client`,
  ])("잘못된 명령은 상태를 바꾸지 않는다: %s", (line) => {
    const state = buildInitialState(scenario);
    const result = run(line, state);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).not.toBe("");
    expect(result.state).toEqual(state);
  });

  it("조회 별칭과 이름 지정을 지원하고 파이프에서 출력만 전달한다", () => {
    expect(run("kubectl get deployments shop-web").stdout).toBe(run("kubectl get deploy/shop-web").stdout);
    expect(run("kubectl get po --output=wide").stdout).toBe(run("kubectl get pods -o wide").stdout);
    expect(run("kubectl get pods | grep ImagePullBackOff | wc -l").stdout.trim()).toBe("2");
    expect(run("kubectl describe deployment/shop-web").stdout).toContain("Recreate");
  });

  it("클러스터가 없는 호스트에서도 예외 대신 연결 오류를 반환한다", () => {
    expect(run("kubectl get pods", ubuntuWeb()).stderr).toContain("connection to the server");
    expect(run("kubectl --help", ubuntuWeb()).exitCode).toBe(0);
  });

  it("코치에는 구현한 작업만 공개하고 모든 풀이 명령을 허용한다", () => {
    const ops = commandOperations(scenario.commands!);
    expect(ops.kubectl).toContain("set image");
    // logs·rollout undo·set env·set resources는 CrashLoop/OOM 실습에서 구현했다. delete는 아직 없다.
    for (const op of ["logs", "rollout undo", "rollout history", "set env", "set resources"]) expect(ops.kubectl).toContain(op);
    expect(ops.kubectl).not.toContain("delete");
    for (const line of scenario.solutionPath) expect(supportsInvocation(line, scenario.commands!), line).toBe(true);
    expect(supportsInvocation("kubectl delete pod example", scenario.commands!)).toBe(false);
  });

  it("모범 풀이의 모든 단계가 성공하고 최종 복구가 참이다", () => {
    let state = buildInitialState(scenario);
    for (const line of scenario.solutionPath) {
      const result = run(line, state);
      expect(result.exitCode, `${line}: ${result.stderr}`).toBe(0);
      state = result.state;
    }
    expect(scenario.resolution(state)).toBe(true);
  });

  it("복구 뒤 원인 제출로 완료되고 세션 재생과 리포트에도 결과가 유지된다", () => {
    let session = createSession(scenario, 1000);
    for (const line of scenario.solutionPath) session = execute(session, line, 2000);
    expect(isCleared(session)).toBe(false);
    session = submitCause(session, scenario.rootCause.answerId, 3000).session;
    expect(isCleared(session)).toBe(true);
    expect(session.finishedAt).toBe(3000);
    const restored = restoreSession(serializeSession(session), [scenario]);
    expect(restored?.state).toEqual(session.state);
    expect(restored?.finishedAt).toBe(3000);
    const report = buildReportMarkdown(session, EMPTY_REFLECTION);
    expect(report).toContain('deployment "shop-web" successfully rolled out');
    expect(report).toContain(scenario.evidence[0].url);
  });
});
