/**
 * Phase 3에서 추가된 엔진 기능들의 단위 테스트.
 * 네트워크 요청 체인, nginx 설정 검증, sed, AWS CLI.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { ubuntuWeb, awsAdmin } from "../src/engine/state/hosts";
import { request, resolveHost, inboundAllowed } from "../src/engine/state/network";
import { validateNginxConf } from "../src/engine/state/config/nginx";
import { findNode } from "../src/engine/state/fs";
import type { SystemState } from "../src/engine/state/types";

const ALL = [
  "help", "ls", "cat", "cd", "pwd", "tail", "df", "du", "rm", "systemctl", "journalctl",
  "curl", "ss", "ufw", "nginx", "sed", "aws",
];

let state: SystemState;

function run(input: string) {
  const result = runCommand(state, input, { available: ALL });
  state = result.state;
  return result;
}

describe("네트워크 요청 체인", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("이름을 해석해 IP를 찾는다", () => {
    expect(resolveHost(state, "api.payments.example.com").ip).toBe("203.0.113.40");
    expect(resolveHost(state, "localhost").ip).toBe("127.0.0.1");
    expect(resolveHost(state, "10.0.1.10").ip).toBe("10.0.1.10");
  });

  it("resolv.conf의 nameserver가 응답하지 않으면 이름 해석이 실패한다", () => {
    // 실제로 resolv.conf를 고쳐서 확인한다 (상태에서 계산된다는 것을 보이는 테스트)
    run("sudo sed -i 's/nameserver 10.0.0.2/nameserver 10.0.0.99/' /etc/resolv.conf");
    const outcome = resolveHost(state, "api.payments.example.com");
    expect(outcome.ip).toBeUndefined();
    expect(outcome.stage).toBe("dns");
  });

  it("로컬 요청은 방화벽을 거치지 않는다", () => {
    // 방화벽에서 80을 막아도 서버 안에서는 접속된다.
    // "안에서는 되는데 밖에서는 안 된다"가 여기서 생긴다.
    run("sudo ufw deny 80");
    expect(request(state, { host: "localhost", port: 80 }).ok).toBe(true);
    expect(inboundAllowed(state, 80)).toBe(false);
  });

  it("아무도 듣고 있지 않은 포트는 연결이 거부된다", () => {
    run("sudo systemctl stop nginx");
    const outcome = request(state, { host: "localhost", port: 80 });
    expect(outcome.ok).toBe(false);
    expect(outcome.stage).toBe("refused");
  });

  it("존재하지 않는 원격 호스트는 타임아웃된다", () => {
    state.network.records["ghost.example.com"] = "198.51.100.9";
    const outcome = request(state, { host: "ghost.example.com", port: 443, tls: true });
    expect(outcome.stage).toBe("unreachable");
  });

  it("만료된 인증서는 TLS 단계에서 걸린다", () => {
    const remote = state.network.world[0];
    remote.services[0].tlsExpiresAt = state.clock - 1000; // 어제 만료
    const outcome = request(state, { host: "api.payments.example.com", port: 443, tls: true });
    expect(outcome.stage).toBe("tls");
  });
});

describe("curl / ss / ufw", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("curl은 실패 단계마다 실제 curl과 같은 에러 코드를 낸다", () => {
    run("sudo systemctl stop nginx");
    expect(run("curl http://localhost").stderr).toContain("curl: (7)");

    run("sudo sed -i 's/nameserver 10.0.0.2/nameserver 10.0.0.99/' /etc/resolv.conf");
    expect(run("curl https://api.payments.example.com").stderr).toContain("curl: (6)");
  });

  it("curl은 값을 받는 옵션의 값을 URL로 읽지 않는다", () => {
    const plain = run("curl -I http://localhost");
    expect(run("curl -i --max-time 5 -I http://localhost").stdout).toBe(plain.stdout);
    expect(run("curl -m 5 --connect-timeout 3 -H 'Host: shop' -I http://localhost").stdout).toBe(plain.stdout);
    expect(run("curl --max-time 5 http://localhost").stderr).not.toContain("resolve host: 5");
  });

  it("ss는 프로세스를 죽이면 그 포트도 함께 사라진다", () => {
    expect(run("ss -tlnp").stdout).toContain("0.0.0.0:80");
    run("sudo systemctl stop nginx");
    expect(run("ss -tlnp").stdout).not.toContain("0.0.0.0:80");
  });

  it("ufw allow는 규칙을 추가하고 status에 반영된다", () => {
    run("sudo ufw deny 80");
    expect(run("sudo ufw status").stdout).toContain("DENY IN");
    run("sudo ufw allow 80/tcp");
    expect(inboundAllowed(state, 80)).toBe(true);
  });

  it("ufw는 root 권한이 필요하다", () => {
    expect(run("ufw status").stderr).toContain("root");
  });
});

describe("nginx 설정 검증", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("정상 설정은 통과한다", () => {
    expect(run("nginx -t").exitCode).toBe(0);
  });

  it("세미콜론이 빠지면 줄 번호와 함께 잡아낸다", () => {
    const check = validateNginxConf("http {\n    sendfile on\n}\n");
    expect(check.ok).toBe(false);
    expect(check.error?.line).toBe(2);
    expect(check.error?.message).toContain("not terminated");
  });

  it("중괄호가 안 닫히면 잡아낸다", () => {
    expect(validateNginxConf("http {\n    sendfile on;\n").ok).toBe(false);
  });

  it("nginx -t 와 서비스 시작 판정이 같은 결과를 낸다", () => {
    run("sudo sed -i 's/worker_connections 768;/worker_connections 768/' /etc/nginx/nginx.conf");
    expect(run("nginx -t").exitCode).not.toBe(0);

    const restart = run("sudo systemctl restart nginx");
    expect(restart.exitCode).not.toBe(0);
    expect(run("journalctl -u nginx").stdout).toContain("not terminated");
  });
});

describe("sed", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("-i 는 파일을 직접 고친다", () => {
    run("sudo sed -i 's/worker_processes auto;/worker_processes 4;/' /etc/nginx/nginx.conf");
    const node = findNode(state.fs, "/etc/nginx/nginx.conf");
    expect(node?.kind === "file" && node.content).toContain("worker_processes 4;");
  });

  it("-i 없이 쓰면 파일은 그대로 두고 결과만 보여준다", () => {
    const result = run("sed 's/worker_processes auto;/worker_processes 4;/' /etc/nginx/nginx.conf");
    expect(result.stdout).toContain("worker_processes 4;");
    const node = findNode(state.fs, "/etc/nginx/nginx.conf");
    expect(node?.kind === "file" && node.content).toContain("worker_processes auto;");
  });

  it("권한이 없으면 고칠 수 없다", () => {
    expect(run("sed -i 's/a/b/' /etc/nginx/nginx.conf").stderr).toContain("Permission denied");
  });
});

describe("AWS CLI", () => {
  beforeEach(() => {
    state = awsAdmin();
  });

  it("describe-instances는 JSON으로 인스턴스를 보여준다", () => {
    const result = run("aws ec2 describe-instances");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stdout).toContain("shop-web-02");
  });

  it("없는 보안그룹을 조회하면 실제와 같은 에러가 난다", () => {
    const result = run("aws ec2 describe-security-groups --group-id sg-doesnotexist");
    expect(result.stderr).toContain("InvalidGroup.NotFound");
  });

  it("authorize-security-group-ingress가 규칙을 추가한다", () => {
    const before = state.aws!.securityGroups[0].ingress.length;
    const result = run(
      "aws ec2 authorize-security-group-ingress --group-id sg-0f1e2d3c4b5a69788 --protocol tcp --port 22 --cidr 10.0.1.0/24",
    );
    expect(result.exitCode).toBe(0);
    expect(state.aws!.securityGroups[0].ingress.length).toBe(before + 1);
  });

  it("같은 규칙을 두 번 넣으면 중복 에러가 난다", () => {
    const command =
      "aws ec2 authorize-security-group-ingress --group-id sg-0f1e2d3c4b5a69788 --protocol tcp --port 22 --cidr 10.0.1.0/24";
    run(command);
    expect(run(command).stderr).toContain("InvalidPermission.Duplicate");
  });
});
