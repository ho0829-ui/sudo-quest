import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { getScenario } from "../src/scenarios";

const sg = "sg-0f1e2d3c4b5a69788";
const ingress = `aws ec2 authorize-security-group-ingress --group-id ${sg} --protocol tcp --port 22 --cidr 10.0.1.0/24`;
function run(id: string, line: string) {
  const scenario = getScenario(id)!;
  const before = buildInitialState(scenario);
  return { scenario, before, result: runCommand(before, line, { available: scenario.commands }) };
}

describe("탐색 점검에서 발견한 입력 회귀", () => {
  it.each([
    ["linux-oom", "sudo kill -0 5218"],
    ["web-ssl-expired", "sudo certbot renew --dry-run"],
    ["aws-security-group", `${ingress} --dry-run`],
  ])("시험 실행은 실제 가상 상태를 변경하지 않는다: %s / %s", (id, line) => {
    const { before, result } = run(id, line);
    expect(result.state).toEqual(before);
  });

  it.each([
    ["network-firewall", "sudo ufw allow 80/udp"],
    ["aws-security-group", `aws ec2 authorize-security-group-ingress --group-id ${sg} --protocol udp --port 22 --cidr 10.0.1.0/24`],
    ["aws-security-group", `aws ec2 authorize-security-group-ingress --group-id ${sg} --protocol tcp --port 22 --cidr 10.9.0.0/24`],
  ])("다른 프로토콜·출발지 허용은 대상 TCP 장애를 복구하지 않는다: %s / %s", (id, line) => {
    const { scenario, result } = run(id, line);
    expect(result.exitCode).toBe(0);
    expect(scenario.resolution(result.state)).toBe(false);
  });

  it.each([
    ["network-firewall", "sudo ufw allow 80/typo"],
    ["network-firewall", "sudo ufw allow 99999/tcp"],
    ["network-firewall", "sudo ufw --dry-run allow 80/tcp"],
    ["linux-oom", "sudo kill -NOTASIGNAL 5218"],
    ["linux-disk-full", "sudo rm --dry-run /var/log/app/app.log"],
    ["aws-security-group", `${ingress} --cidr garbage`],
    ["aws-iam-s3", "aws iam attach-role-policy --role-name shop-web-role --policy-arn garbage/AmazonS3FullAccess"],
    ["db-max-connections", "mysql -e 'SET GLOBAL max_connections = Infinity'"],
    ["linux-disk-full", "journalctl -n invalid"],
    ["linux-disk-full", "journalctl -n -1"],
    ["web-nginx-config", "sudo systemctl restart nginx --dry-run"],
    ["linux-permission", "sudo chmod --dry-run 644 /var/www/html/index.html"],
    ["linux-permission", "sudo chown --dry-run www-data /var/www/html/index.html"],
    ["network-dns", "sudo sed -i --dry-run 's/10.0.0.53/10.0.0.2/' /etc/resolv.conf"],
    ["network-dns", "sudo sed -i 's/10.0.0.53/10.0.0.2' /etc/resolv.conf"],
    ["aws-security-group", `${ingress} --unknown`],
    ["aws-security-group", `${ingress} --port 70000`],
    ["aws-iam-s3", "aws iam attach-role-policy --role-name shop-web-role --policy-arn arn:aws:iam::999999999999:policy/AmazonS3FullAccess"],
    ["aws-iam-s3", "aws iam attach-role-policy --role-name shop-web-role --policy-arn arn:aws:iam::aws:policy/MissingPolicy"],
    ["linux-oom", "sudo kill 5218; ps aux"],
    ["linux-oom", "sudo kill 5218 && ps aux"],
    ["linux-oom", "sudo kill '5218"],
  ])("오입력·미구현 옵션을 성공 처리하거나 상태에 적용하지 않는다: %s / %s", (id, line) => {
    const { before, result } = run(id, line);
    expect(result.exitCode).not.toBe(0);
    expect(result.state).toEqual(before);
  });

  it("journalctl -n 0은 로그 본문을 출력하지 않는다", () => {
    const { result } = run("linux-disk-full", "journalctl -n 0");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("No space left on device");
  });

  it("TCP와 UDP 규칙은 같은 포트 번호여도 독립적으로 유지한다", () => {
    const { scenario, result } = run("network-firewall", "sudo ufw allow 80/udp");
    const next = runCommand(result.state, "sudo ufw allow 80/tcp", { available: scenario.commands });
    expect(next.state.network.firewall.rules.filter(r => r.port === 80)).toHaveLength(2);
    expect(scenario.resolution(next.state)).toBe(true);
  });

  it("시험 실행은 명령별 결과 코드와 안내를 반환한다", () => {
    expect(run("linux-oom", "sudo kill -0 5218").result.exitCode).toBe(0);
    expect(run("web-ssl-expired", "sudo certbot renew --dry-run").result.stdout).toContain("No certificates were saved");
    const aws = run("aws-security-group", `${ingress} --dry-run`).result;
    expect(aws.exitCode).toBe(255);
    expect(aws.stderr).toContain("DryRunOperation");
  });
});
