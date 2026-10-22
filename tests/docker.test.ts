/**
 * docker 명령 출력과 오류 문장. 실제 docker CLI 모양과 같은지, 상태를 바꾸면 출력이 따라 바뀌는지 본다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { dockerHost } from "../src/engine/state/hosts";
import { writeFile } from "../src/engine/state/fs";
import type { SystemState } from "../src/engine/state/types";
import { dockerMissingEnv } from "../src/scenarios/docker-missing-env";
import { dockerPortAllocated } from "../src/scenarios/docker-port-allocated";

const available = ["docker", "curl", "ss", "ps", "systemctl", "cat"];

/** 여러 줄을 차례로 실행하고 마지막 결과를 돌려준다. */
function session(state: SystemState) {
  let current = state;
  return (line: string) => {
    const result = runCommand(current, line, { available });
    current = result.state;
    return result;
  };
}

describe("docker 조회", () => {
  it("ps는 실행 중만, -a는 Created·Exited까지, -q는 ID만, --format은 필드만 보여 준다", () => {
    const run = session(buildInitialState(dockerPortAllocated));
    expect(run("docker ps").stdout.split("\n")[0]).toMatch(/^CONTAINER ID {3}IMAGE {2,}COMMAND {2,}CREATED {2,}STATUS {2,}PORTS {2,}NAMES$/);
    expect(run("docker ps").stdout).not.toContain("shop-api-2.1.0");
    expect(run("docker ps -a").stdout).toMatch(/shop-api:2\.1\.0 .* 35 minutes ago +Created +shop-api-2\.1\.0/);
    expect(run("docker ps -aq").stdout.split("\n")).toHaveLength(3);
    expect(run("docker ps -a --format '{{.Names}}:{{.State}}'").stdout.split("\n").sort())
      .toEqual(["shop-api-2.0.3:running", "shop-api-2.1.0:created", "status-page:running"]);
    expect(run("docker container ls -a").stdout).toBe(run("docker ps -a").stdout);
  });

  it("images·port·inspect -f는 상태에서 계산한 값을 낸다", () => {
    const run = session(buildInitialState(dockerPortAllocated));
    expect(run("docker images").stdout).toMatch(/^shop-api {3,}2\.1\.0 {3,}[0-9a-f]{12} {3,}24 hours ago {3,}182MB$/m);
    expect(run("docker port shop-api-2.0.3").stdout).toBe("8080/tcp -> 0.0.0.0:8080");
    expect(run("docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' shop-api-2.1.0").stdout).toBe("created 128");
    expect(run("docker inspect -f '{{json .HostConfig.RestartPolicy}}' shop-api-2.0.3").stdout).toBe('{"Name":"unless-stopped","MaximumRetryCount":0}');
    expect(JSON.parse(run("docker inspect status-page").stdout)[0].State.Running).toBe(true);
    const missing = run("docker inspect nope");
    expect([missing.stdout, missing.stderr, missing.exitCode]).toEqual(["[]", "Error: No such object: nope", 1]);
    expect(run("docker inspect -f '{{range .Config.Env}}' status-page").stderr).toMatch(/^template parsing error/);
  });

  it("반복 종료한 컨테이너의 로그는 실행마다 이어 붙고 --tail로 자른다", () => {
    const run = session(buildInitialState(dockerMissingEnv));
    const lines = run("docker logs notify-worker").stdout.split("\n");
    expect(lines.filter(line => line.startsWith("FATAL"))).toHaveLength(6);
    expect(run("docker logs --tail 1 notify-worker").stdout).toBe("FATAL config: required environment variable SMTP_PASSWORD is not set");
    expect(run("docker logs -n x notify-worker").stderr).toBe('invalid value for "tail": x');
  });
});

describe("docker 상태 변경", () => {
  it("다른 컨테이너가 포트를 잡으면 port is already allocated, 일반 프로세스면 address already in use", () => {
    const run = session(buildInitialState(dockerPortAllocated));
    const started = run("docker start shop-api-2.1.0");
    expect(started.exitCode).toBe(1);
    expect(started.stderr).toMatch(/Bind for 0\.0\.0\.0:8080 failed: port is already allocated\nError: failed to start containers: shop-api-2\.1\.0$/);
    const host = run("docker run -d --name web -p 80:80 nginx:1.25-alpine");
    expect(host.exitCode).toBe(125);
    expect(host.stderr).toContain("Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use");
  });

  it("실행 중인 컨테이너는 -f 없이 지울 수 없고, 멈추면 포트와 응답이 함께 사라진다", () => {
    const run = session(buildInitialState(dockerPortAllocated));
    expect(run("docker rm shop-api-2.0.3").stderr).toBe('Error response from daemon: cannot remove container "/shop-api-2.0.3": container is running: stop the container before removing or force remove');
    expect(run("docker stop shop-api-2.0.3").stdout).toBe("shop-api-2.0.3");
    expect(run("ss -tlnp").stdout).not.toContain(":8080");
    expect(run("curl -s localhost:8080/version").exitCode).toBe(7);
    expect(run("docker start shop-api-2.1.0").exitCode).toBe(0);
    expect(run("curl -i localhost:8080/api/coupons").stdout).toMatch(/^HTTP\/1\.1 200 OK\nX-Powered-By: Express/);
  });

  it("run은 이름 충돌·없는 이미지·잘못된 옵션을 실제 문장(종료 코드 125)으로 거절한다", () => {
    const run = session(buildInitialState(dockerPortAllocated));
    expect(run("docker run -d --name status-page nginx:1.25-alpine").stderr).toMatch(/^docker: Error response from daemon: Conflict\. The container name "\/status-page" is already in use/);
    expect(run("docker run -d redis:7").stderr).toMatch(/^Unable to find image 'redis:7' locally\ndocker: Error response from daemon: pull access denied for redis/);
    expect(run("docker run --rm nginx:1.25-alpine")).toMatchObject({ stderr: "unknown flag: --rm\nSee 'docker run --help'.", exitCode: 125 });
    expect(run("docker run -d --restart sometimes nginx:1.25-alpine").stderr).toContain("unknown policy 'sometimes'");
    expect(run("docker run -d -p 99999:80 nginx:1.25-alpine").stderr).toBe("docker: Invalid hostPort: 99999.\nSee 'docker run --help'.");
    expect(run("docker frob").stderr).toBe("docker: 'frob' is not a docker command.\nSee 'docker --help'");
  });

  it("-e KEY(값 없음)는 넣지 않고, --env-file은 읽기 권한을 검사하며 -e가 우선한다", () => {
    const state = buildInitialState(dockerMissingEnv);
    writeFile(state.fs, "/root/secret.env", { mode: 0o600, content: "SMTP_PASSWORD=x" });
    const run = session(state);
    run("docker rm notify-worker");
    expect(run("docker run -d --name w1 --env-file /root/secret.env notify-worker:1.4.0").stderr).toBe("docker: open /root/secret.env: permission denied.\nSee 'docker run --help'.");
    run("docker run -d --name w2 -e SMTP_PASSWORD --env-file /opt/notify/notify.env -e SMTP_USER=ops@shop.example.com notify-worker:1.4.0");
    const env = run("docker inspect -f '{{json .Config.Env}}' w2").stdout;
    expect(env).toContain("SMTP_PASSWORD=virtual-lab-not-a-real-secret");
    expect(env).toContain("SMTP_USER=ops@shop.example.com");
    run("docker run -d --name w3 -e SMTP_PASSWORD notify-worker:1.4.0");
    expect(run("docker inspect -f '{{.Config.Env}}' w3").stdout).not.toContain("SMTP_PASSWORD");
  });

  it("데몬이 멈추면 CLI가 연결하지 못하고, 다시 뜨면 재시작 정책대로 되살린다", () => {
    const run = session(dockerHost());
    run("docker run -d --name keep --restart always -p 9000:80 nginx:1.25-alpine");
    run("docker stop keep status-page");
    run("sudo systemctl restart docker");
    expect(run("docker ps --format '{{.Names}}'").stdout).toBe("keep");
    run("sudo systemctl stop docker");
    expect(run("docker ps").stderr).toBe("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
    expect(run("ss -tlnp").stdout).not.toContain("docker-proxy");
  });
});
