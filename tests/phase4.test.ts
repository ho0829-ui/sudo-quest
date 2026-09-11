/**
 * Phase 4에서 추가된 엔진 기능 단위 테스트.
 * 권한→403, 설정에서 바인드 주소 읽기, 인증서, AWS ALB/IAM, mysql.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { awsAdmin, ubuntuWeb } from "../src/engine/state/hosts";
import { request } from "../src/engine/state/network";
import { hasHealthyTarget } from "../src/engine/state/aws";
import { buildInitialState } from "../src/engine/scenario/build";
import { dbMaxConnections } from "../src/scenarios/db-max-connections";
import type { SystemState } from "../src/engine/state/types";

const ALL = [
  "help", "ls", "cat", "cd", "pwd", "tail", "df", "du", "rm", "systemctl", "journalctl",
  "curl", "ss", "ufw", "nginx", "sed", "aws", "chmod", "chown", "ping", "dig",
  "free", "ps", "dmesg", "kill", "openssl", "certbot", "mysql",
];

let state: SystemState;

function run(input: string) {
  const result = runCommand(state, input, { available: ALL });
  state = result.state;
  return result;
}

describe("웹 루트 권한 → HTTP 상태 코드", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("읽을 수 없으면 403, 권한을 주면 200", () => {
    expect(request(state, { host: "localhost", port: 80 }).status).toBe(200);

    run("sudo chmod 600 /var/www/html/index.html");
    run("sudo chown root:root /var/www/html/index.html");
    expect(request(state, { host: "localhost", port: 80 }).status).toBe(403);
    expect(run("curl -I http://localhost").stdout).toContain("403");

    run("sudo chmod 644 /var/www/html/index.html");
    expect(request(state, { host: "localhost", port: 80 }).status).toBe(200);
  });

  it("파일이 없으면 404", () => {
    run("sudo rm /var/www/html/index.html");
    expect(request(state, { host: "localhost", port: 80 }).status).toBe(404);
  });

  it("chown 은 root만 할 수 있다", () => {
    expect(run("chown ubuntu /var/www/html/index.html").stderr).toContain("not permitted");
  });

  it("chmod 는 기호 표기도 받는다", () => {
    run("sudo chmod 600 /var/www/html/index.html");
    run("sudo chmod o+r /var/www/html/index.html");
    expect(request(state, { host: "localhost", port: 80 }).status).toBe(200);
  });
});

describe("설정에서 바인드 주소를 읽는다", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("설정만 고치면 아무것도 바뀌지 않는다", () => {
    run("sudo sed -i 's/host: 0.0.0.0/host: 127.0.0.1/' /opt/app/config.yml");
    // 돌고 있는 프로세스는 시작할 때 읽은 설정으로 계속 동작한다
    expect(run("ss -tlnp").stdout).toContain("0.0.0.0:3000");
  });

  it("재시작해야 반영된다", () => {
    run("sudo sed -i 's/host: 0.0.0.0/host: 127.0.0.1/' /opt/app/config.yml");
    run("sudo systemctl restart shop-api");
    const output = run("ss -tlnp").stdout;
    expect(output).toContain("127.0.0.1:3000");
    expect(output).not.toContain("0.0.0.0:3000");
  });
});

describe("TLS 인증서", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("openssl 로 만료일을 볼 수 있다", () => {
    const result = run("openssl x509 -enddate -noout -in /etc/letsencrypt/live/shop.example.com/fullchain.pem");
    expect(result.stdout).toMatch(/^notAfter=/);
  });

  it("만료되면 HTTPS 요청이 TLS 단계에서 실패한다", () => {
    state.certificates[0].notAfter = state.clock - 86400_000;
    const outcome = request(state, { host: "shop.example.com", port: 443, tls: true });
    expect(outcome.stage).toBe("tls");
    expect(run("curl https://shop.example.com").stderr).toContain("curl: (60)");
  });

  it("certbot renew 가 유효기간을 연장한다", () => {
    state.certificates[0].notAfter = state.clock - 86400_000;
    run("sudo certbot renew");
    expect(state.certificates[0].notAfter).toBeGreaterThan(state.clock);
    expect(request(state, { host: "shop.example.com", port: 443, tls: true }).ok).toBe(true);
  });

  it("아직 여유가 있으면 갱신을 건너뛴다 (실제 certbot과 같다)", () => {
    const before = state.certificates[0].notAfter;
    state.certificates[0].notAfter = state.clock + 60 * 86400_000;
    const result = run("sudo certbot renew");
    expect(result.stdout).toContain("not yet due");
    expect(state.certificates[0].notAfter).not.toBe(before);
  });
});

describe("AWS ALB / IAM", () => {
  beforeEach(() => {
    state = awsAdmin();
  });

  const TG = "arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/shop-tg/73e2d6bc24d8a067";

  it("헬스체크 경로가 서빙되지 않으면 unhealthy가 된다", () => {
    expect(hasHealthyTarget(state, TG)).toBe(true);
    state.aws!.targetGroups![0].healthCheckPath = "/nope";
    expect(hasHealthyTarget(state, TG)).toBe(false);

    const result = run(`aws elbv2 describe-target-health --target-group-arn ${TG}`);
    expect(result.stdout).toContain("unhealthy");
    expect(result.stdout).toContain("Target.ResponseCodeMismatch");
  });

  it("modify-target-group 으로 고치면 healthy로 돌아온다", () => {
    state.aws!.targetGroups![0].healthCheckPath = "/nope";
    run(`aws elbv2 modify-target-group --target-group-arn ${TG} --health-check-path /health`);
    expect(hasHealthyTarget(state, TG)).toBe(true);
  });

  it("헬스체크 경로는 / 로 시작해야 한다", () => {
    const result = run(`aws elbv2 modify-target-group --target-group-arn ${TG} --health-check-path health`);
    expect(result.stderr).toContain("ValidationError");
  });

  it("attach-role-policy 가 역할에 정책을 붙인다", () => {
    expect(run("aws iam list-attached-role-policies --role-name shop-web-role").stdout).not.toContain("AmazonS3FullAccess");
    run("aws iam attach-role-policy --role-name shop-web-role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess");
    expect(run("aws iam list-attached-role-policies --role-name shop-web-role").stdout).toContain("AmazonS3FullAccess");
  });

  it("없는 역할은 실제와 같은 에러를 낸다", () => {
    expect(run("aws iam list-attached-role-policies --role-name nope").stderr).toContain("NoSuchEntity");
  });
});

describe("mysql", () => {
  beforeEach(() => {
    state = buildInitialState(dbMaxConnections);
  });

  it("SHOW VARIABLES 가 설정값을 보여준다", () => {
    const result = run("mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"");
    expect(result.stdout).toContain("max_connections");
    expect(result.stdout).toContain("100");
  });

  it("LIKE 의 % 패턴이 동작한다", () => {
    const result = run("mysql -e \"SHOW STATUS LIKE 'Connection_errors%'\"");
    expect(result.stdout).toContain("Connection_errors_max_connections");
  });

  it("SET GLOBAL 이 설정값을 바꾼다", () => {
    run("mysql -e \"SET GLOBAL max_connections = 300\"");
    expect(state.database!.variables.max_connections).toBe("300");
  });

  it("없는 변수를 바꾸려 하면 에러가 난다", () => {
    expect(run("mysql -e \"SET GLOBAL nonexistent = 1\"").stderr).toContain("Unknown system variable");
  });

  it("DB가 없는 서버에서는 연결 자체가 실패한다", () => {
    state = ubuntuWeb();
    expect(run("mysql -e \"SHOW VARIABLES\"").stderr).toContain("Can't connect");
  });
});

describe("진단 명령어", () => {
  beforeEach(() => {
    state = ubuntuWeb();
  });

  it("free 는 프로세스를 죽이면 사용량이 줄어든다", () => {
    const before = run("free -m").stdout;
    run("sudo systemctl stop shop-api");
    expect(run("free -m").stdout).not.toBe(before);
  });

  it("ps 는 메모리 많이 쓰는 순으로 보여준다", () => {
    const lines = run("ps aux").stdout.split("\n");
    const rss = lines.slice(1).map((l) => Number(l.trim().split(/\s+/)[4]));
    expect(rss).toEqual([...rss].sort((a, b) => b - a));
  });

  it("kill 은 서비스 프로세스를 죽이면 서비스도 failed 가 된다", () => {
    const pid = state.services.find((s) => s.name === "nginx")!.mainPid!;
    run(`sudo kill ${pid}`);
    expect(run("systemctl is-active nginx").stdout).toBe("failed");
  });

  it("ping 은 닿지 않는 주소에서 패킷 손실을 보고한다", () => {
    state.network.records["ghost.example.com"] = "198.51.100.9";
    const result = run("ping -c 2 ghost.example.com");
    expect(result.stdout).toContain("100% packet loss");
    expect(result.exitCode).not.toBe(0);
  });

  it("dig 는 DNS 서버에 닿지 못하면 그렇게 말한다", () => {
    run("sudo sed -i 's/nameserver 10.0.0.2/nameserver 10.0.0.99/' /etc/resolv.conf");
    expect(run("dig api.payments.example.com").stdout).toContain("connection timed out");
  });
});
