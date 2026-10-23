import { describe, expect, it } from "vitest";
import { kubernetesAdmin } from "../src/engine/state/hosts/kubernetesAdmin";
import { addDeployment, changeTemplate, undoTo } from "../src/engine/state/kubernetes/history";
import { podReady, reconcileKubernetes } from "../src/engine/state/kubernetes/reconcile";
import { effectiveRestarts, formatMemory, outcome, parseMemory, restartsSince, runLog } from "../src/engine/state/kubernetes/runtime";
import type { ImageProfile } from "../src/engine/state/kubernetes/types";

const image: ImageProfile = { ports: [8080], paths: ["/"], requiredEnv: ["DB_HOST"], memoryMi: 300,
  log: { boot: ["boot"], ready: ["ready"] } };

describe("컨테이너 결과 판정(runtime)", () => {
  it("이미지 없음 → 환경 변수 누락 → 메모리 초과 → 정상 순서로 판정한다", () => {
    expect(outcome({ name: "a", image: "x" }, undefined)).toEqual({ kind: "pull" });
    // 환경 변수와 메모리가 둘 다 문제면 시작 직후의 설정 검사가 먼저 실패한다.
    expect(outcome({ name: "a", image: "x", resources: { limits: { memoryMi: 128 } } }, image))
      .toEqual({ kind: "crash", last: { reason: "Error", exitCode: 1 }, missingEnv: "DB_HOST" });
    expect(outcome({ name: "a", image: "x", env: { DB_HOST: "db" }, resources: { limits: { memoryMi: 128 } } }, image))
      .toEqual({ kind: "crash", last: { reason: "OOMKilled", exitCode: 137 } });
    expect(outcome({ name: "a", image: "x", env: { DB_HOST: "db" }, resources: { limits: { memoryMi: 512 } } }, image)).toEqual({ kind: "run" });
    // limit이 없으면 컨테이너 한도로는 죽지 않는다. 빈 값의 환경 변수는 없는 것으로 본다.
    expect(outcome({ name: "a", image: "x", env: { DB_HOST: "db" } }, image)).toEqual({ kind: "run" });
    expect(outcome({ name: "a", image: "x", env: { DB_HOST: "" } }, image).kind).toBe("crash");
  });

  it("로그: 설정 오류는 원인 한 줄, OOM은 아무 말 없이 끊기고, 정상은 ready까지 찍는다", () => {
    expect(runLog({ name: "a", image: "x" }, image)).toEqual(["boot", "FATAL config: required environment variable DB_HOST is not set"]);
    expect(runLog({ name: "a", image: "x", env: { DB_HOST: "d" }, resources: { limits: { memoryMi: 64 } } }, image)).toEqual(["boot"]);
    expect(runLog({ name: "a", image: "x", env: { DB_HOST: "d" } }, image)).toEqual(["boot", "ready"]);
  });

  it("재시작 횟수는 10초부터 두 배씩, 최대 300초 간격의 back-off로 계산한다", () => {
    expect([0, 9, 10, 30, 70, 150, 310, 609, 610, 910, 3000].map(s => restartsSince(0, s * 1000)))
      .toEqual([1, 1, 2, 3, 4, 5, 6, 6, 7, 8, 14]);
  });

  it("메모리 수량을 MiB로 읽고 틀린 형식·0 이하를 거절한다", () => {
    expect(parseMemory("512Mi")).toBe(512);
    expect(parseMemory("1Gi")).toBe(1024);
    expect(parseMemory("268435456")).toBe(256);
    expect(parseMemory("500M")).toBeCloseTo(476.84, 1);
    for (const bad of ["512MB", "abc", "0Mi", "-1Mi", "", "1.5.2Mi"]) expect(parseMemory(bad), bad).toBeUndefined();
    expect([formatMemory(1024), formatMemory(512), formatMemory(128)]).toEqual(["1Gi", "512Mi", "128Mi"]);
  });
});

describe("반복 종료와 배포 이력", () => {
  function crashing() {
    const state = kubernetesAdmin();
    const cluster = state.kubernetes!;
    cluster.images["app:1"] = image;
    addDeployment(cluster, { name: "app", replicas: 1, labels: { app: "app" }, createdAt: state.clock,
      containers: [{ name: "app", image: "app:1", env: { DB_HOST: "db" } }], changeCause: "release app:1" });
    reconcileKubernetes(cluster, state.clock);
    changeTemplate(cluster.deployments[2], "drop env", t => { t.containers[0].env = {}; });
    reconcileKubernetes(cluster, state.clock);
    return { state, cluster };
  }

  it("시작 후 종료되는 컨테이너는 파드 Running·Ready 아님·BackOff 이벤트이고, 다시 계산해도 시작 시각이 그대로다", () => {
    const { state, cluster } = crashing();
    const pod = cluster.pods.find(p => p.deployment === "app")!;
    expect(pod.phase).toBe("Running");
    expect(podReady(pod)).toBe(false);
    expect(pod.containers[0]).toMatchObject({ reason: "CrashLoopBackOff", lastState: { reason: "Error", exitCode: 1 }, crashingSince: state.clock });
    expect(cluster.events.some(e => e.reason === "BackOff" && e.pod === pod.name)).toBe(true);
    const before = structuredClone(cluster);
    reconcileKubernetes(cluster, state.clock + 600_000);
    expect(cluster).toEqual(before);
    expect(effectiveRestarts(cluster.pods.find(p => p.deployment === "app")!.containers[0], state.clock + 610_000)).toBe(7);
  });

  it("되돌리기는 예전 템플릿을 새 revision으로 올리고, 같은 템플릿 기록은 한 줄만 남긴다", () => {
    const { state, cluster } = crashing();
    const app = cluster.deployments[2];
    expect(app.revision).toBe(2);
    expect(changeTemplate(app, "noop", () => undefined)).toBe(false);
    expect(undoTo(app)).toEqual({ ok: true });
    reconcileKubernetes(cluster, state.clock);
    expect(app.revision).toBe(3);
    expect(app.history.map(h => [h.revision, h.changeCause])).toEqual([[2, "drop env"], [3, "release app:1"]]);
    expect(podReady(cluster.pods.find(p => p.deployment === "app")!)).toBe(true);
    // 직전으로 한 번 더 되돌리면 다시 깨진 템플릿으로 간다(실제 kubectl rollout undo와 같은 왕복).
    expect(undoTo(app)).toEqual({ ok: true });
    expect(app.template.containers[0].env).toEqual({});
    expect(undoTo(app, 99)).toEqual({ ok: false, missing: 99 });
    const single = cluster.deployments[1];
    expect(undoTo(single)).toEqual({ ok: false, missing: 0 });
  });
});
