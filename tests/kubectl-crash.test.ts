import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { kubernetesCrashloop } from "../src/scenarios/kubernetes-crashloop";
import { kubernetesOom } from "../src/scenarios/kubernetes-oom";
import type { SystemState } from "../src/engine/state/types";

const crash = () => buildInitialState(kubernetesCrashloop);
const oom = () => buildInitialState(kubernetesOom);
const run = (line: string, state: SystemState) => runCommand(state, line, { available: kubernetesCrashloop.commands });
const POD = "order-api-0000000002-00001";

describe("kubectl logs", () => {
  it("반복 종료 컨테이너는 마지막 실행 로그를, deploy/NAME은 고른 파드를 stderr로 알린다", () => {
    const state = crash();
    const own = run(`kubectl logs ${POD}`, state);
    expect(own.stdout.split("\n").at(-1)).toBe("FATAL config: required environment variable PAYMENT_API_URL is not set");
    expect(run(`kubectl logs ${POD} -p`, state).stdout).toBe(own.stdout);
    expect(run(`kubectl logs ${POD} --tail=1`, state).stdout).toBe("FATAL config: required environment variable PAYMENT_API_URL is not set");
    expect(run(`kubectl logs ${POD} --tail 0`, state).stdout).toBe("");
    const viaDeploy = run("kubectl logs deployment/order-api -c order", state);
    expect(viaDeploy.exitCode).toBe(0);
    expect(viaDeploy.stderr).toBe(`Found 2 pods, using pod/${POD}`);
  });

  it("OOM은 오류 줄 없이 캐시 적재에서 끊긴다", () => {
    const lines = run("kubectl logs catalog-api-0000000002-00001 --previous", oom()).stdout.split("\n");
    expect(lines.at(-1)).toContain("loading product catalog cache");
    expect(lines.join("\n")).not.toMatch(/FATAL|ERROR|panic/);
  });

  it.each([
    ["kubectl logs", "POD or TYPE/NAME is a required argument"],
    ["kubectl logs missing-pod", 'pods "missing-pod" not found'],
    [`kubectl logs ${POD} -c web`, `container web is not valid for pod ${POD}`],
    ["kubectl logs shop-web-0000000001-00001 --previous", 'previous terminated container "web" in pod "shop-web-0000000001-00001" not found'],
    [`kubectl logs ${POD} --tail=abc`, 'invalid argument "abc" for "--tail" flag'],
    [`kubectl logs ${POD} --since=1h`, "unknown flag: --since"],
    ["kubectl logs svc/order-api", "cannot get the logs from svc"],
  ])("잘못된 요청은 실제 형식의 오류를 내고 상태를 바꾸지 않는다: %s", (line, message) => {
    const state = crash();
    const result = run(line, state);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(message);
    expect(result.state).toEqual(state);
  });

  it("이미지를 받지 못한 컨테이너는 아직 시작하지 않아 로그가 없다", () => {
    const pulled = run("kubectl set image deploy/order-api order=registry.example.com/shop/order-api:9.9.9", crash()).state;
    const result = run("kubectl logs order-api-0000000003-00001", pulled);
    expect(result.stderr).toBe('Error from server (BadRequest): container "order" in pod "order-api-0000000003-00001" is waiting to start: trying and failing to pull image');
  });
});

describe("kubectl set env · set resources", () => {
  it("--list는 현재 값을 보이고, KEY-는 지우며, 바뀌지 않으면 revision을 올리지 않는다", () => {
    const state = crash();
    expect(run("kubectl set env deploy/order-api --list", state).stdout).toBe("# Deployment order-api, container order\nDB_HOST=orders-db\nDB_PORT=5432");
    const removed = run("kubectl set env deploy/order-api DB_PORT-", state).state;
    expect(run("kubectl set env deploy/order-api --list", removed).stdout).not.toContain("DB_PORT");
    expect(run("kubectl rollout history deploy/order-api", removed).stdout).toContain("3          <none>");
    const same = run("kubectl set env deploy/order-api DB_HOST=orders-db", state);
    expect(same.stdout).toBe("deployment.apps/order-api env updated");
    expect(same.state).toEqual(state);
  });

  it("limit은 MiB로 바꿔 저장하고 describe에 보이며, request>limit이면 API가 거절한다", () => {
    const state = oom();
    const raised = run("kubectl set resources deploy/catalog-api --limits=memory=1Gi,cpu=500m", state);
    expect(raised.stdout).toBe("deployment.apps/catalog-api resource requirements updated");
    expect(run("kubectl describe deploy catalog-api", raised.state).stdout).toMatch(/Limits:\n\s+cpu:\s+500m\n\s+memory:\s+1Gi/);
    const invalid = run("kubectl set resources deploy/catalog-api --requests=memory=512Mi", state);
    expect(invalid.stderr).toContain('Invalid value: "512Mi": must be less than or equal to memory limit of 128Mi');
    expect(invalid.state).toEqual(state);
  });

  it.each([
    ["kubectl set env deploy/order-api", "at least one environment change"],
    ["kubectl set env deploy/order-api 1BAD=x", "invalid env: 1BAD=x"],
    ["kubectl set env deploy/order-api -c web A=1", 'unable to find container named "web"'],
    ["kubectl set env pod/order-api A=1", "required syntax"],
    ["kubectl set resources deploy/order-api", "must specify an update to requests or limits"],
    ["kubectl set resources deploy/order-api --limits=memory=512MB", "quantities must match the regular expression"],
    ["kubectl set resources deploy/order-api --limits=disk=1Gi", "invalid resource specification: disk=1Gi"],
    ["kubectl set resources deploy/order-api --limits", "flag needs an argument: --limits"],
    ["kubectl set resources deploy/missing --limits=memory=1Gi", 'deployments.apps "missing" not found'],
  ])("잘못된 변경은 아무것도 바꾸지 않는다: %s", (line, message) => {
    const state = crash();
    const result = run(line, state);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(message);
    expect(result.state).toEqual(state);
  });
});

describe("kubectl rollout history · undo", () => {
  it("이력을 revision 순으로 보이고, undo는 직전 템플릿으로 되돌린다", () => {
    const state = crash();
    expect(run("kubectl rollout history deployment/order-api", state).stdout)
      .toBe("deployment.apps/order-api\nREVISION   CHANGE-CAUSE\n1          release order-api:2.2.4\n2          release order-api:2.3.0");
    const undone = run("kubectl rollout undo deployment/order-api", state);
    expect(undone.stdout).toBe("deployment.apps/order-api rolled back");
    expect(kubernetesCrashloop.resolution(undone.state)).toBe(true);
    expect(run("kubectl rollout history deployment/order-api", undone.state).stdout).toContain("3          release order-api:2.2.4");
  });

  it.each([
    ["kubectl rollout undo deployment/status-page", 'no rollout history found for deployment "status-page"'],
    ["kubectl rollout undo deployment/order-api --to-revision=7", "unable to find specified revision 7 in history"],
    ["kubectl rollout undo deployment/order-api --to-revision=two", 'invalid argument "two" for "--to-revision" flag'],
    ["kubectl rollout history deployment/missing", 'deployments.apps "missing" not found'],
    ["kubectl rollout restart deployment/order-api", "unknown command"],
  ])("되돌릴 수 없는 요청: %s", (line, message) => {
    const state = crash();
    const result = run(line, state);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(message);
    expect(result.state).toEqual(state);
  });
});
