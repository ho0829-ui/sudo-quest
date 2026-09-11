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
import { diskUsage, memoryUsage, portOwner } from "../state/derived";
import { findNode, normalizePath } from "../state/fs";
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

/** 해당 주소:포트를 무언가가 listen 하고 있는가 */
export function portIsListening(addr: string, port: number): Check {
  return (state) => portOwner(state, addr, port) !== undefined;
}

/** 파일 내용에 특정 문자열이 들어있는가 (설정 수정 판정용) */
export function fileContains(path: string, text: string): Check {
  return (state) => {
    const node = findNode(state.fs, normalizePath("/", path));
    return node?.kind === "file" && node.content.includes(text);
  };
}
