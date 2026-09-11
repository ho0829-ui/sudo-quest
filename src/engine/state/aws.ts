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

    if (!instance || instance.state !== "running") {
      return {
        instanceId,
        port: group.port,
        state: "unused" as const,
        reason: "Target.NotInUse",
        description: "Target is in an Availability Zone that is not enabled for the load balancer",
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

/** 이 역할이 해당 정책을 가지고 있는가 */
export function roleHasPolicy(state: SystemState, roleName: string, policy: string): boolean {
  const role = state.aws?.roles?.find((r) => r.name === roleName);
  return role?.attachedPolicies.includes(policy) ?? false;
}
