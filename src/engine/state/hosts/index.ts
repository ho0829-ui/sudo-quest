/**
 * 호스트 프리셋 목록.
 * 시나리오는 여기서 "정상 상태"를 골라 시작한다.
 */
import { awsAdmin } from "./awsAdmin";
import { ubuntuWeb } from "./ubuntuWeb";
import { kubernetesAdmin } from "./kubernetesAdmin";
import { dockerHost } from "./dockerHost";

export const hostPresets = {
  "ubuntu-web": ubuntuWeb,
  "aws-admin": awsAdmin,
  "kubernetes-admin": kubernetesAdmin,
  "docker-host": dockerHost,
};

export type HostPreset = keyof typeof hostPresets;

export { ubuntuWeb, awsAdmin, dockerHost };
