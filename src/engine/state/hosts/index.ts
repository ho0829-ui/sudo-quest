/**
 * 호스트 프리셋 목록.
 * 시나리오는 여기서 "정상 상태"를 골라 시작한다.
 */
import { awsAdmin } from "./awsAdmin";
import { ubuntuWeb } from "./ubuntuWeb";
import { kubernetesAdmin } from "./kubernetesAdmin";

export const hostPresets = {
  "ubuntu-web": ubuntuWeb,
  "aws-admin": awsAdmin,
  "kubernetes-admin": kubernetesAdmin,
};

export type HostPreset = keyof typeof hostPresets;

export { ubuntuWeb, awsAdmin };
