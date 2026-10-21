import { describe, expect, it } from "vitest";
import { AWS_OPERATIONS } from "../src/engine/commands/aws";
import { commandOperations, DEFAULT_COMMANDS, supportsInvocation } from "../src/engine/commands";
import { runCommand } from "../src/engine/run";
import { awsAdmin } from "../src/engine/state/hosts";
import { runnableCommands } from "../src/ui/coachPrompts";

const WITH_AWS = [...DEFAULT_COMMANDS, "aws", "curl"];

describe("aws 하위 명령 표", () => {
  // 표에 적은 하위 명령이 실제로 구현되어 있어야 코치 제안 검사가 거짓말을 하지 않는다.
  for (const [service, operations] of Object.entries(AWS_OPERATIONS)) {
    for (const operation of operations) {
      it(`aws ${service} ${operation}는 구현되어 있다`, () => {
        const result = runCommand(awsAdmin(), `aws ${service} ${operation}`, { available: WITH_AWS });
        expect(result.stderr).not.toContain("Unknown subcommand");
        expect(result.stderr).not.toContain("Unknown service");
      });
    }
  }

  it("표에 없는 하위 명령은 지원 목록과 함께 거부한다", () => {
    const result = runCommand(awsAdmin(), "aws elbv2 delete-load-balancer", { available: WITH_AWS });
    expect(result.exitCode).toBe(252);
    expect(result.stderr).toContain(`지원: ${AWS_OPERATIONS.elbv2.join(", ")}`);
    expect(runCommand(awsAdmin(), "aws sts whoami", { available: WITH_AWS }).stderr).toContain("Unknown subcommand: whoami");
  });
});

describe("코치 제안 명령 판별", () => {
  it("사용 가능한 명령 중 하위 명령 목록이 있는 것만 모은다", () => {
    expect(commandOperations(DEFAULT_COMMANDS)).toEqual({});
    expect(commandOperations(WITH_AWS).aws).toContain("elbv2 describe-target-health");
  });

  it("aws는 서비스와 하위 명령까지 맞아야 한다", () => {
    expect(supportsInvocation("aws elbv2 describe-target-health --target-group-arn arn:x", WITH_AWS)).toBe(true);
    expect(supportsInvocation("sudo aws sts get-caller-identity", WITH_AWS)).toBe(true);
    expect(supportsInvocation("aws cloudwatch describe-alarms --alarm-name-prefix shop", WITH_AWS)).toBe(false);
    expect(supportsInvocation("aws elbv2", WITH_AWS)).toBe(false);
    expect(supportsInvocation("aws elbv2 describe-target-health", DEFAULT_COMMANDS)).toBe(false);
  });

  it("하위 명령 목록이 없는 명령은 이름만 본다", () => {
    expect(supportsInvocation("du -h /var/log", DEFAULT_COMMANDS)).toBe(true);
    expect(supportsInvocation("lsof +L1", DEFAULT_COMMANDS)).toBe(false);
  });

  it("터미널 입력 버튼에서 지원하지 않는 aws 서비스를 뺀다", () => {
    const check = "`aws elbv2 describe-target-health` 후 `aws cloudwatch describe-alarms`로 알람 확인";
    expect(runnableCommands(check, WITH_AWS)).toEqual(["aws elbv2 describe-target-health"]);
  });
});
