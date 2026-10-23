/**
 * readiness probe 판정, 라벨 셀렉터 조회, set selector·patch. 출력은 상태에서 계산되고 실제 kubectl 문장과 같아야 한다.
 */
import { describe, expect, it } from "vitest";
import { supportsInvocation, withCommands } from "../src/engine/commands";
import { age } from "../src/engine/commands/kubectl/resources";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import type { SystemState } from "../src/engine/state/types";
import { kubernetesReadiness } from "../src/scenarios/kubernetes-readiness";
import { kubernetesServiceSelector } from "../src/scenarios/kubernetes-service-selector";

const available = withCommands("kubectl");
const POD = "search-api-0000000002-00001";

function session(state: SystemState) {
  let current = state;
  return (line: string) => {
    const result = runCommand(current, line, { available });
    current = result.state;
    return result;
  };
}

const probePatch = (path: string, port: number | string) =>
  `kubectl patch deploy search-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","readinessProbe":{"httpGet":{"path":"${path}","port":${JSON.stringify(port)}}}}]}}}}'`;

describe("readiness probe", () => {
  it("경로가 없으면 404, 포트가 다르면 연결 거부로 실패하고 Conditions의 Ready가 False다", () => {
    const run = session(buildInitialState(kubernetesReadiness));
    const describe = run(`kubectl describe pod ${POD}`).stdout;
    expect(describe).toContain("Readiness probe failed: HTTP probe failed with statuscode: 404");
    expect(describe).toMatch(/Conditions:\n  Type +Status\n  Initialized +True\n  Ready +False/);
    run(probePatch("/healthz", 8081));
    expect(run("kubectl get events | grep Unhealthy").stdout)
      .toContain('Readiness probe failed: Get "http://10.244.2.10:8081/healthz": dial tcp 10.244.2.10:8081: connect: connection refused');
    expect(run("kubectl get endpoints search-api").stdout).toContain("<none>");
  });

  it("접근 로그를 남기는 앱은 kubelet 요청과 응답 코드가 로그에 찍히고, 고치면 200이 된다", () => {
    const run = session(buildInitialState(kubernetesReadiness));
    expect(run(`kubectl logs ${POD} --tail=1`).stdout).toMatch(/^10\.0\.2\.11 - - \[11\/Sep\/2026:09:15:00 \+0000\] "GET \/health HTTP\/1\.1" 404 19 "-" "kube-probe\/1\.30"$/);
    run(probePatch("/healthz", 8080));
    expect(run("kubectl logs deploy/search-api --tail=1").stdout).toContain('"GET /healthz HTTP/1.1" 200');
    expect(run("kubectl describe deploy search-api").stdout).toContain("Readiness:  http-get http://:8080/healthz delay=0s timeout=1s period=10s");
  });
});

describe("라벨 셀렉터 조회", () => {
  it("-l은 =, !=, 있음, 없음 조건을 받고 --show-labels는 LABELS 열을 붙인다", () => {
    const run = session(buildInitialState(kubernetesServiceSelector));
    const names = (line: string) => run(line).stdout.split("\n").slice(1).map(row => row.split(/\s+/)[0]);
    expect(names("kubectl get pods -l app.kubernetes.io/name=payment-api")).toEqual(["payment-api-0000000001-00001", "payment-api-0000000001-00002"]);
    expect(names("kubectl get pods -l app,app!=shop-web")).toEqual(["status-page-0000000001-00001"]);
    expect(names("kubectl get pods -l '!app'")).toHaveLength(2);
    expect(run("kubectl get pods -l app=payment").stdout).toBe("No resources found in default namespace.");
    expect(run("kubectl get pods -l =x").stderr).toMatch(/^error: unable to parse requirement/);
    expect(run("kubectl get deploy --show-labels").stdout.split("\n")[0]).toMatch(/AGE +LABELS$/);
  });

  it("EndpointSlice는 서비스 이름 라벨로 고르고, 고른 파드가 없으면 <unset>이다", () => {
    const run = session(buildInitialState(kubernetesServiceSelector));
    expect(run("kubectl get endpointslices -l kubernetes.io/service-name=payment").stdout).toMatch(/^payment-[0-9a-z]{5} +IPv4 +<unset> +<unset> +30d$/m);
  });
});

describe("Service 셀렉터 바꾸기", () => {
  it("set selector는 셀렉터를 통째로 바꾸고, Deployment 셀렉터는 바꿀 수 없다", () => {
    const run = session(buildInitialState(kubernetesServiceSelector));
    expect(run("kubectl set selector deploy/payment-api app=x").stderr).toContain("field is immutable");
    expect(run("kubectl set selector svc payment app=pay ment").stderr).toBe('error: invalid selector: "ment"');
    expect(run("kubectl set selector service/payment app.kubernetes.io/name=payment-api").stdout).toBe("service/payment selector updated");
    expect(run("kubectl describe svc payment").stdout).toContain("Selector:                 app.kubernetes.io/name=payment-api\n");
  });

  it("patch는 셀렉터를 키 단위로 합쳐 옛 키가 남고, null로 지워야 엔드포인트가 생긴다", () => {
    const run = session(buildInitialState(kubernetesServiceSelector));
    run(`kubectl patch svc payment -p '{"spec":{"selector":{"app.kubernetes.io/name":"payment-api"}}}'`);
    expect(run("kubectl get endpoints payment").stdout).toContain("<none>");
    expect(run(`kubectl patch svc payment --type merge -p '{"spec":{"selector":{"app":null}}}'`).stdout).toBe("service/payment patched");
    expect(run("kubectl get endpoints payment").stdout).toContain("10.244.2.10:8080,10.244.2.11:8080");
    expect(run(`kubectl patch svc payment -p '{"spec":{"selector":{"app":null}}}'`).stdout).toBe("service/payment patched (no change)");
  });

  it("셀렉터를 그대로 둔 채 파드에 라벨을 더하는 patch는 허용되어 서비스가 새 파드를 고른다", () => {
    const run = session(buildInitialState(kubernetesServiceSelector));
    expect(run(`kubectl patch deployment payment-api -p '{"spec":{"template":{"metadata":{"labels":{"app":"payment"}}}}}'`).exitCode).toBe(0);
    expect(run("kubectl get endpoints payment").stdout).toMatch(/payment +10\.244\.2\.10:8080,10\.244\.2\.11:8080/);
    expect(kubernetesServiceSelector.resolution(runCommand(buildInitialState(kubernetesServiceSelector),
      `kubectl patch deployment payment-api -p '{"spec":{"template":{"metadata":{"labels":{"app":"payment"}}}}}'`, { available }).state)).toBe(true);
  });
});

describe("kubectl patch 입력 검사", () => {
  it.each([
    [`kubectl patch deploy search-api -p '{bad'`, /^error: unable to parse "\{bad"/],
    [`kubectl patch deploy search-api --type json -p '[]'`, /not supported/],
    [`kubectl patch deploy search-api -p '{"spec":{"paused":true}}'`, /\.spec\.paused: field not declared in schema$/],
    [`kubectl patch deploy search-api -p '{"spec":{"replicas":-1}}'`, /spec\.replicas: Invalid value: -1/],
    [`kubectl patch deploy search-api --type merge -p '{"spec":{"template":{"spec":{"containers":[{"name":"api"}]}}}}'`, /containers\[0\]\.image: Required value/],
    [probePatch("/healthz", "http"), /httpGet\.port: Invalid value: "http"/],
    ["kubectl patch deploy search-api", /must specify -p/],
    [`kubectl patch pod ${POD} -p '{}'`, /patching pods is not supported/],
  ])("%s", (line, error) => {
    const state = buildInitialState(kubernetesReadiness);
    const result = runCommand(state, line, { available });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(error);
    expect(result.state).toEqual(state);
  });
});

describe("표기와 코치 제안", () => {
  it.each([[59, "59s"], [600, "10m"], [3 * 3600, "3h"], [47 * 3600, "47h"], [5 * 86400, "5d"], [3 * 86400 + 4 * 3600, "3d4h"], [30 * 86400, "30d"]])(
    "AGE %d초 → %s", (seconds, text) => expect(age(0, seconds * 1000)).toBe(text));

  it("set selector·patch·describe svc는 코치가 제안할 수 있는 명령이다", () => {
    expect(supportsInvocation("kubectl set selector svc payment app=x", available)).toBe(true);
    expect(supportsInvocation(`kubectl patch deployment web -p '{}'`, available)).toBe(true);
    expect(supportsInvocation("kubectl describe svc payment", available)).toBe(true);
    expect(supportsInvocation("kubectl edit deployment web", available)).toBe(false);
  });
});
