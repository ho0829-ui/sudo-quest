/**
 * 시나리오 목록.
 * 새 시나리오를 추가하려면 파일을 만들고 여기에 한 줄만 넣으면 된다.
 */
import type { Scenario } from "../engine/scenario/types";
import { linuxDiskFull } from "./linux-disk-full";
import { networkFirewall } from "./network-firewall";
import { webNginxConfig } from "./web-nginx-config";
import { awsSecurityGroup } from "./aws-security-group";

export const scenarios: Scenario[] = [
  linuxDiskFull,
  networkFirewall,
  webNginxConfig,
  awsSecurityGroup,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
