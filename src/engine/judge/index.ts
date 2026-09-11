/**
 * 복구 판정 헬퍼.
 *
 * 시나리오의 resolution을 문장처럼 읽히게 만드는 게 목적이다.
 *   resolution: all(diskUsageBelow("/", 90), serviceIsActive("nginx"))
 *
 * 새 판정 조건이 필요하면 여기에 함수를 하나 추가한다.
 * 시나리오 파일에서 직접 (state) => boolean 을 써도 되므로,
 * 엔진을 고치지 않고도 특수한 판정을 만들 수 있다.
 */
import { hasHealthyTarget, roleHasPolicy } from "../state/aws";
import { validateNginxConf } from "../state/config/nginx";
import { diskUsage, listeningSockets, memoryUsage } from "../state/derived";
import { findNode, normalizePath } from "../state/fs";
import { inboundAllowed, request } from "../state/network";
import { findService } from "../state/services";
import type { SystemState } from "../state/types";

export type Check = (state: SystemState) => boolean;

/** 모든 조건을 만족해야 통과 */
export function all(...checks: Check[]): Check {
  return (state) => checks.every((check) => check(state));
}

/** 하나라도 만족하면 통과 */
export function any(...checks: Check[]): Check {
  return (state) => checks.some((check) => check(state));
}

export function not(check: Check): Check {
  return (state) => !check(state);
}

export function serviceIsActive(name: string): Check {
  return (state) => findService(state, name)?.state === "active";
}

export function diskUsageBelow(mount: string, percent: number): Check {
  return (state) => diskUsage(state, mount).usePercent < percent;
}

export function memoryUsageBelow(percent: number): Check {
  return (state) => {
    const { totalKB, usedKB } = memoryUsage(state);
    return (usedKB / totalKB) * 100 < percent;
  };
}

export function fileExists(path: string): Check {
  return (state) => findNode(state.fs, normalizePath("/", path)) !== null;
}

export function fileSizeBelowKB(path: string, sizeKB: number): Check {
  return (state) => {
    const node = findNode(state.fs, normalizePath("/", path));
    if (!node) return true; // 지워졌으면 당연히 작다
    return node.kind === "file" && node.sizeKB < sizeKB;
  };
}

/**
 * 정확히 이 주소:포트에서 듣고 있는가.
 *
 * 주소를 엄격하게 비교한다. 0.0.0.0 을 물었는데 127.0.0.1 바인딩이 통과하면
 * "밖에서 접근 가능한가"를 판정할 수 없기 때문이다.
 */
export function portIsListening(addr: string, port: number): Check {
  return (state) => listeningSockets(state).some((s) => s.port === port && s.addr === addr);
}

/** 파일 내용에 특정 문자열이 들어있는가 (설정 수정 판정용) */
export function fileContains(path: string, text: string): Check {
  return (state) => {
    const node = findNode(state.fs, normalizePath("/", path));
    return node?.kind === "file" && node.content.includes(text);
  };
}

// ---------- 네트워크 ----------

/** 외부에서 이 포트로 들어오는 접속을 방화벽이 허용하는가 */
export function firewallAllows(port: number): Check {
  return (state) => inboundAllowed(state, port);
}

/**
 * 이 주소로 HTTP 요청을 보내면 정상 응답이 오는가.
 *
 * "연결이 됐는가"만 보면 안 된다. 403이나 502도 연결은 된 것이라서,
 * 상태 코드까지 확인해야 진짜 복구됐는지 판정할 수 있다.
 */
export function httpResponds(host: string, port = 80, tls = false, expectStatus = 200): Check {
  return (state) => {
    const outcome = request(state, { host, port, tls });
    return outcome.ok && outcome.status === expectStatus;
  };
}

// ---------- 설정 파일 ----------

export function nginxConfigIsValid(path = "/etc/nginx/nginx.conf"): Check {
  return (state) => {
    const node = findNode(state.fs, normalizePath("/", path));
    return node?.kind === "file" && validateNginxConf(node.content).ok;
  };
}

// ---------- AWS ----------

/** 이 타깃 그룹에 정상(healthy)인 타깃이 있는가 */
export function targetGroupIsHealthy(targetGroupArn: string): Check {
  return (state) => hasHealthyTarget(state, targetGroupArn);
}

/** IAM 역할에 이 정책이 붙어 있는가 */
export function iamRoleHasPolicy(roleName: string, policy: string): Check {
  return (state) => roleHasPolicy(state, roleName, policy);
}

/** 보안그룹 인바운드에 이 포트를 여는 규칙이 있는가 */
export function securityGroupAllows(groupId: string, port: number): Check {
  return (state) => {
    const group = state.aws?.securityGroups.find((g) => g.groupId === groupId);
    if (!group) return false;
    return group.ingress.some(
      (rule) => rule.protocol === "-1" || (rule.fromPort <= port && port <= rule.toPort),
    );
  };
}
