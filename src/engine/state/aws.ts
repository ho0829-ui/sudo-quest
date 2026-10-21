/**
 * AWS 리소스에서 계산되는 값들.
 *
 * 타깃의 health 상태를 시나리오가 정해두지 않는다.
 * "헬스체크가 때리는 경로를 그 인스턴스가 실제로 서빙하는가"를 보고 계산한다.
 * 그래서 헬스체크 경로를 고치면 타깃이 저절로 healthy가 된다.
 */
import type { SystemState, TargetGroup } from "./types";

export interface TargetHealth {
  instanceId: string;
  port: number;
  state: "healthy" | "unhealthy" | "unused";
  reason?: string;
  description?: string;
}

export function targetHealth(state: SystemState, group: TargetGroup): TargetHealth[] {
  const cloud = state.aws;
  if (!cloud) return [];

  return group.targetIds.map((instanceId) => {
    const instance = cloud.instances.find((i) => i.instanceId === instanceId);
    const served = cloud.servedPaths?.[instanceId] ?? [];

    // AWS 타깃 상태 표: 중지·종료된 타깃은 unused이며 사유는 Target.InvalidState다.
    // (Target.NotInUse는 리스너 규칙 미사용·비활성 AZ일 때의 사유라 여기에 쓰면 틀린 단서가 된다.)
    if (!instance || instance.state !== "running") {
      return {
        instanceId,
        port: group.port,
        state: "unused" as const,
        reason: "Target.InvalidState",
        description: "Target is in the stopped or terminated state",
      };
    }

    if (!served.includes(group.healthCheckPath)) {
      return {
        instanceId,
        port: group.port,
        state: "unhealthy" as const,
        reason: "Target.ResponseCodeMismatch",
        description: "Health checks failed with these codes: [404]",
      };
    }

    return { instanceId, port: group.port, state: "healthy" as const };
  });
}

/** 이 타깃 그룹에 healthy한 타깃이 하나라도 있는가 */
export function hasHealthyTarget(state: SystemState, targetGroupArn: string): boolean {
  const group = state.aws?.targetGroups?.find((g) => g.arn === targetGroupArn);
  if (!group) return false;
  return targetHealth(state, group).some((t) => t.state === "healthy");
}

export interface InstanceReply {
  /** false면 패킷이 버려진 것(중지된 인스턴스·보안그룹 차단) → 클라이언트는 timeout */
  reachable: boolean;
  status: number;
  body: string;
}

/** "10.0.1.5"가 "10.0.1.0/24" 안에 있는가 */
function inCidr(ip: string, cidr: string): boolean {
  const [base, bits = "32"] = cidr.split("/");
  const toNumber = (addr: string) => addr.split(".").reduce((n, part) => n * 256 + Number(part), 0);
  const size = 2 ** (32 - Number(bits));
  return Math.floor(toNumber(ip) / size) === Math.floor(toNumber(base) / size);
}

/**
 * VPC 안의 EC2 인스턴스로 보내는 HTTP 요청(포트 80)을 상태에서 계산한다.
 * ALB 헬스체크와 같은 servedPaths를 쓰므로, 헬스체크가 404인 경로는 직접 요청해도 404다.
 * 이 IP가 우리 인스턴스가 아니거나 HTTP 포트가 아니면 null(다른 네트워크 규칙에 맡긴다).
 */
export function requestInstance(
  state: SystemState, ip: string, port: number, path: string, sourceIp: string,
): InstanceReply | null {
  const cloud = state.aws;
  const instance = cloud?.instances.find((i) => i.privateIp === ip || i.publicIp === ip);
  if (!cloud || !instance || port !== 80) return null;

  const allowed = cloud.securityGroups
    .filter((group) => instance.securityGroupIds.includes(group.groupId))
    .some((group) => group.ingress.some((rule) =>
      (rule.protocol === "-1" || (rule.protocol === "tcp" && rule.fromPort <= port && port <= rule.toPort))
      && inCidr(sourceIp, rule.cidr)));
  if (instance.state !== "running" || !allowed) return { reachable: false, status: 0, body: "" };

  const served = cloud.servedPaths?.[instance.instanceId] ?? [];
  return served.includes(path)
    ? { reachable: true, status: 200, body: "OK\n" }
    : { reachable: true, status: 404, body: "<html>\n<head><title>404 Not Found</title></head>\n</html>\n" };
}

/** 이 역할이 해당 정책을 가지고 있는가 */
export function roleHasPolicy(state: SystemState, roleName: string, policy: string): boolean {
  const role = state.aws?.roles?.find((r) => r.name === roleName);
  return role?.attachedPolicies.includes(policy) ?? false;
}
