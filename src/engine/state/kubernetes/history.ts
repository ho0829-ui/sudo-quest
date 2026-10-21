/**
 * Deployment 템플릿 변경과 배포 이력. 실제 Deployment처럼 템플릿이 바뀔 때만 revision을 올리고,
 * 되돌리기(rollout undo)는 예전 템플릿을 새 revision으로 다시 올린다.
 */
import type { ContainerSpec, KubeDeployment, KubernetesState, PodTemplate } from "./types";

const sameTemplate = (a: PodTemplate, b: PodTemplate) => JSON.stringify(a) === JSON.stringify(b);

/** 같은 템플릿의 옛 기록은 지운다. rollout history가 같은 내용을 두 줄로 보여 주지 않는다. */
function record(deployment: KubeDeployment, changeCause: string) {
  deployment.history = deployment.history.filter(h => !sameTemplate(h.template, deployment.template));
  deployment.history.push({ revision: deployment.revision, template: structuredClone(deployment.template), changeCause });
}

/** 템플릿을 고친다. 실제로 달라졌으면 revision을 올리고 true. 호출한 쪽이 reconcile한다. */
export function changeTemplate(deployment: KubeDeployment, changeCause: string, mutate: (template: PodTemplate) => void): boolean {
  const next = structuredClone(deployment.template);
  mutate(next);
  if (sameTemplate(next, deployment.template)) return false;
  deployment.template = next;
  deployment.revision++;
  record(deployment, changeCause);
  return true;
}

/** 지정한(없으면 직전) revision의 템플릿으로 되돌린다. 찾지 못하면 그 revision 번호를, 없으면 0을 돌려준다. */
export function undoTo(deployment: KubeDeployment, toRevision?: number): { ok: true } | { ok: false; missing: number } {
  const previous = deployment.history.filter(h => h.revision !== deployment.revision).sort((a, b) => b.revision - a.revision);
  const target = toRevision === undefined ? previous[0] : deployment.history.find(h => h.revision === toRevision);
  if (!target) return { ok: false, missing: toRevision ?? 0 };
  if (target.revision === deployment.revision) return { ok: true };
  deployment.template = structuredClone(target.template);
  deployment.revision++;
  record(deployment, target.changeCause);
  return { ok: true };
}

export interface NewDeployment {
  name: string;
  replicas: number;
  labels: Record<string, string>;
  containers: ContainerSpec[];
  changeCause: string;
  createdAt: number;
  /** 같은 이름·라벨로 ClusterIP Service도 만든다. */
  service?: { clusterIP: string; port: number; targetPort: number };
}

/** 시나리오가 클러스터에 앱을 하나 더 올릴 때 쓴다(Deployment + 이력 1번 + 선택적 Service). */
export function addDeployment(cluster: KubernetesState, app: NewDeployment) {
  const template: PodTemplate = { labels: { ...app.labels }, containers: structuredClone(app.containers) };
  cluster.deployments.push({
    name: app.name, replicas: app.replicas, revision: 1, createdAt: app.createdAt, strategy: "Recreate",
    template, history: [{ revision: 1, template: structuredClone(template), changeCause: app.changeCause }],
  });
  if (app.service) cluster.services.push({ name: app.name, selector: { ...app.labels }, createdAt: app.createdAt, ...app.service });
}
