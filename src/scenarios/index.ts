/**
 * 시나리오 목록.
 * 새 시나리오를 추가하려면 파일을 만들고 여기에 한 줄만 넣으면 된다.
 */
import type { Scenario } from "../engine/scenario/types";
import { linuxDiskFull } from "./linux-disk-full";
import { networkFirewall } from "./network-firewall";
import { webNginxConfig } from "./web-nginx-config";
import { awsSecurityGroup } from "./aws-security-group";
import { linuxPermission } from "./linux-permission";
import { networkDns } from "./network-dns";
import { linuxPortConflict } from "./linux-port-conflict";
import { linuxOom } from "./linux-oom";
import { networkBindLocalhost } from "./network-bind-localhost";
import { webSslExpired } from "./web-ssl-expired";
import { awsAlbHealthcheck } from "./aws-alb-healthcheck";
import { awsIamS3 } from "./aws-iam-s3";
import { dbMaxConnections } from "./db-max-connections";
import { kubernetesImagePull } from "./kubernetes-image-pull";
import { kubernetesCrashloop } from "./kubernetes-crashloop";
import { kubernetesOom } from "./kubernetes-oom";
import { dockerPortAllocated } from "./docker-port-allocated";
import { dockerMissingEnv } from "./docker-missing-env";
import { kubernetesReadiness } from "./kubernetes-readiness";
import { kubernetesServiceSelector } from "./kubernetes-service-selector";
import { dockerDiskFull } from "./docker-disk-full";
import { linuxTooManyFiles } from "./linux-too-many-files";

export const scenarios: Scenario[] = [
  linuxDiskFull,
  linuxPermission,
  linuxPortConflict,
  linuxOom,
  networkFirewall,
  networkDns,
  networkBindLocalhost,
  webNginxConfig,
  webSslExpired,
  dbMaxConnections,
  awsSecurityGroup,
  awsAlbHealthcheck,
  awsIamS3,
  kubernetesImagePull,
  // 실습 번호는 이 순서다. 기존 번호가 밀리지 않게 새 실습은 끝에 붙인다.
  kubernetesCrashloop,
  kubernetesOom,
  dockerPortAllocated,
  dockerMissingEnv,
  kubernetesReadiness,
  kubernetesServiceSelector,
  dockerDiskFull,
  linuxTooManyFiles,
];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
