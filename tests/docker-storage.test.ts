/**
 * Docker 디스크 모델: 레이어 파일이 사용량의 기준이고, prune·rmi·system df·df·du가 같은 파일을 본다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { humanSize } from "../src/engine/state/docker/format";
import { dockerHost } from "../src/engine/state/hosts";
import type { SystemState } from "../src/engine/state/types";
import { dockerDiskFull } from "../src/scenarios/docker-disk-full";

const available = dockerDiskFull.commands;

function session(state: SystemState) {
  let current = state;
  return (line: string) => {
    const result = runCommand(current, line, { available });
    current = result.state;
    return result;
  };
}

describe("Docker 디스크 사용량", () => {
  it("df는 경로가 속한 디스크만, system df는 공유 레이어를 한 번만 센다", () => {
    const run = session(buildInitialState(dockerDiskFull));
    expect(run("df -h /var/lib/docker").stdout.split("\n")).toEqual([
      expect.stringMatching(/^Filesystem/), expect.stringMatching(/^\/dev\/nvme1n1 +\d+G +\d+G +200K +100% \/var\/lib\/docker$/)]);
    expect(run("df /nope").stderr).toBe("df: /nope: No such file or directory");
    const summary = run("docker system df").stdout;
    expect(summary).toMatch(/^Images +40 +4 +25\.2GB +21\.48GB \(85%\)$/m);
    expect(summary).toMatch(/^Build Cache +140 +0 +26GB +26GB$/m);
    // docker images의 SIZE는 공유 레이어를 이미지마다 다시 센다(25개 × 1.16GB ≫ 실제 사용량).
    expect(run("docker images -f dangling=true").stdout.split("\n").slice(1).every(row => row.endsWith("1.16GB"))).toBe(true);
  });

  it("가득 찬 디스크에서는 새 컨테이너를 만들지 못한다", () => {
    const result = runCommand(buildInitialState(dockerDiskFull), "docker run -d --name probe nginx:1.25-alpine", { available });
    expect(result.exitCode).toBe(125);
    expect(result.stderr).toMatch(/^docker: Error response from daemon: mkdir \/var\/lib\/docker\/overlay2\/[0-9a-f]{64}-init: no space left on device/);
  });

  it.each([[0, "0B"], [212, "212B"], [16_000_000, "16MB"], [25_200_000_000, "25.2GB"], [21_480_000_000, "21.48GB"]])("%d바이트 → %s", (bytes, text) => {
    expect(humanSize(bytes)).toBe(text);
  });
});

describe("prune", () => {
  it("-f가 없으면 확인을 묻고 아무것도 지우지 않는다", () => {
    const state = buildInitialState(dockerDiskFull);
    for (const line of ["docker image prune -a", "docker builder prune", "docker container prune", "docker system prune -a"]) {
      const result = runCommand(state, line, { available });
      expect(result.stdout, line).toMatch(/^WARNING! .*\n?[\s\S]*Are you sure you want to continue\? \[y\/N\] $/);
      expect(result.state, line).toEqual(state);
    }
  });

  it("image prune은 dangling만, -a는 컨테이너가 쓰지 않는 이미지만 지운다(멈춘 컨테이너도 이미지를 붙잡는다)", () => {
    const run = session(buildInitialState(dockerDiskFull));
    expect(run("docker image prune -f").stdout).toMatch(/Total reclaimed space: 8\.28GB$/);
    expect(run("docker images -f dangling=true -q").stdout).toBe("");
    run("docker image prune -a -f");
    const left = run("docker images").stdout;
    expect(left).toContain("2.0.8");
    expect(left).toContain("2.1.0 ");
    expect(left).not.toContain("2.0.7");
    run("docker container prune -f");
    expect(run("docker image prune -a -f").stdout).toMatch(/untagged: shop-api:2\.0\.8/);
  });

  it("--filter until은 그보다 오래된 이미지만, builder prune 기본은 dangling 캐시만 지운다", () => {
    const run = session(buildInitialState(dockerDiskFull));
    run("docker image prune -a -f --filter until=240h");
    expect(run("docker images shop-api").stdout).not.toContain("2.0.0");
    // dev 빌드는 13일 전부터 하루 두 번 → 10일(240h)보다 오래된 6개만 지워진다.
    expect(run("docker images -f dangling=true -q").stdout.split("\n")).toHaveLength(19);
    expect(run("docker builder prune -f").stdout).toMatch(/Total:\t24GB$/);
    expect(run("docker system df").stdout).toMatch(/^Build Cache +20 +0 +2GB +2GB$/m);
    expect(run("docker buildx prune -a -f").stdout).toMatch(/Total:\t2GB$/);
    expect(run("docker image prune --filter label=x").stderr).toBe("Error response from daemon: invalid filter 'label=x'");
  });

  it("system prune -a -f는 멈춘 컨테이너부터 지우고 실행 중인 서비스는 남긴다", () => {
    const run = session(buildInitialState(dockerDiskFull));
    const out = run("docker system prune -a -f").stdout;
    expect(out.indexOf("Deleted Containers:")).toBeLessThan(out.indexOf("Deleted Images:"));
    expect(out).toContain("Deleted build cache objects:");
    expect(run("docker ps --format '{{.Names}}'").stdout.split("\n").sort()).toEqual(["shop-api", "status-page"]);
    expect(run("curl -s localhost:8080/version").stdout).toContain('"version":"2.1.0"');
  });
});

describe("rmi와 손으로 지우기", () => {
  it("실행 중인 컨테이너의 이미지는 -f로도, 멈춘 컨테이너의 이미지는 -f 없이 지울 수 없다", () => {
    const run = session(buildInitialState(dockerDiskFull));
    expect(run("docker rmi shop-api:2.1.0").stderr).toMatch(/unable to remove repository reference "shop-api:2\.1\.0" \(must force\) - container [0-9a-f]{12} is using/);
    expect(run("docker rmi -f shop-api:2.1.0").stderr).toMatch(/unable to delete [0-9a-f]{12} \(cannot be forced\) - image is being used by running container/);
    expect(run("docker rmi -f shop-api:2.0.8").stdout).toBe("Untagged: shop-api:2.0.8");
    expect(run("docker image rm shop-api:2.0.0").stdout).toMatch(/^Untagged: shop-api:2\.0\.0\nDeleted: sha256:[0-9a-f]{64}\nDeleted: sha256:/);
    expect(run("docker rmi redis").stderr).toBe("Error response from daemon: No such image: redis:latest");
  });

  it("/var/lib/docker를 rm으로 지우면 공간은 비지만 컨테이너를 다시 띄울 수 없다", () => {
    const run = session(dockerHost());
    run("sudo rm -rf /var/lib/docker/overlay2");
    const restarted = run("docker restart status-page");
    expect(restarted.exitCode).toBe(1);
    expect(restarted.stderr).toMatch(/error creating overlay mount to \/var\/lib\/docker\/overlay2\/[0-9a-f]{64}\/merged: no such file or directory$/);
  });
});

describe("코치 제안용 정리 명령", () => {
  it("system df·prune·rmi는 지원 명령이고 volume prune은 아니다", async () => {
    const { supportsInvocation } = await import("../src/engine/commands");
    for (const line of ["docker system df", "docker builder prune -f", "docker image prune -a -f", "docker rmi shop-api:2.0.0", "docker buildx prune -f"]) {
      expect(supportsInvocation(line, available!), line).toBe(true);
    }
    expect(supportsInvocation("docker volume prune -f", available!)).toBe(false);
  });
});
