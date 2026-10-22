/**
 * 컨테이너 만들기·시작·정지·삭제와 데몬 재시작. docker 명령과 시나리오 fault가 같은 함수를 쓴다.
 * 공개 포트는 실제 Docker 기본값처럼 docker-proxy 프로세스가 호스트 포트를 잡는다.
 * 그래서 ss -tlnp·curl·다른 서비스의 포트 충돌 판정이 따로 손대지 않아도 따라 바뀐다.
 */
import { runOutcome } from "../containers/runtime";
import { nextPid, portOwner } from "../derived";
import type { SystemState } from "../types";
import { hexId } from "./format";
import { containerView, findImage, runSpec, totalRuns } from "./runtime";
import type { DockerContainer, DockerState, PortBinding, RestartPolicy } from "./types";

export interface NewContainer {
  name: string;
  image: string;
  env?: Record<string, string>;
  ports?: PortBinding[];
  restart?: RestartPolicy;
  createdAt: number;
}

export function createContainer(docker: DockerState, spec: NewContainer): { ok: true; container: DockerContainer } | { ok: false; error: string } {
  const image = findImage(docker, spec.image);
  if (!image) return { ok: false, error: `Unable to find image '${spec.image}' locally` };
  const taken = docker.containers.find(c => c.name === spec.name);
  if (taken) {
    return { ok: false, error: `Conflict. The container name "/${spec.name}" is already in use by container "${taken.id}". You have to remove (or rename) that container to be able to reuse that name.` };
  }
  const container: DockerContainer = {
    id: hexId(`${spec.name}@${spec.createdAt}`), name: spec.name, image: spec.image, imageId: image.id, cmd: image.cmd,
    createdAt: spec.createdAt, env: spec.env ?? {}, ports: spec.ports ?? [], restart: spec.restart ?? { name: "no", maximumRetryCount: 0 },
    state: "created", exitCode: 0, pastRuns: 0, manuallyStopped: false, error: "",
  };
  docker.containers.push(container);
  return { ok: true, container };
}

/** 포트가 이미 잡혀 있으면 실제 dockerd가 내는 문장. 다른 컨테이너인지 일반 프로세스인지에 따라 문장이 다르다. */
function portError(state: SystemState, container: DockerContainer): string | null {
  for (const binding of container.ports) {
    const addr = binding.hostIp || "0.0.0.0";
    const owner = portOwner(state, addr, binding.hostPort);
    if (!owner) continue;
    const process = state.processes.find(p => p.pid === owner.pid);
    if (process?.container === container.id) continue;
    const prefix = `driver failed programming external connectivity on endpoint ${container.name} (${container.id})`;
    return process?.container
      ? `${prefix}: Bind for ${addr}:${binding.hostPort} failed: port is already allocated`
      : `${prefix}: Error starting userland proxy: listen tcp4 ${addr}:${binding.hostPort}: bind: address already in use`;
  }
  return null;
}

function nextIp(docker: DockerState): string {
  const used = new Set(docker.containers.map(c => c.ip));
  let n = 2;
  while (used.has(`172.17.0.${n}`)) n++;
  return `172.17.0.${n}`;
}

function addProxies(state: SystemState, container: DockerContainer) {
  for (const binding of container.ports) {
    state.processes.push({
      pid: nextPid(state), user: "root", cpu: 0, memKB: 3 * 1024, service: "docker", container: container.id,
      command: `/usr/bin/docker-proxy -proto ${binding.proto} -host-ip ${binding.hostIp || "0.0.0.0"} -host-port ${binding.hostPort} -container-ip ${container.ip} -container-port ${binding.containerPort}`,
      listenPorts: [{ addr: binding.hostIp || "0.0.0.0", port: binding.hostPort }],
    });
  }
}

function removeProxies(state: SystemState, container: DockerContainer) {
  state.processes = state.processes.filter(p => p.container !== container.id);
}

/** at: 시작한 시각. 시나리오가 "사흘 전에 띄운 컨테이너"를 만들 때 과거 시각을 넘긴다. */
export function startContainer(state: SystemState, container: DockerContainer, at = state.clock): { ok: true } | { ok: false; error: string } {
  const docker = state.docker!;
  const view = containerView(container, at);
  if (view.status === "running" || view.status === "restarting") return { ok: true };
  const error = portError(state, container);
  if (error) {
    container.error = error;
    if (container.state === "created") container.exitCode = 128;
    return { ok: false, error };
  }
  // 손으로 다시 시작하면 재시작 횟수는 0부터 다시 센다. 지난 실행은 로그를 위해 pastRuns에 남긴다.
  container.pastRuns = totalRuns(container, at);
  container.error = "";
  container.manuallyStopped = false;
  container.startedAt = at;
  const image = docker.images.find(i => i.id === container.imageId)!;
  const result = runOutcome(runSpec(container, image), image.profile);
  if (result.kind === "run") {
    container.state = "running";
    container.exitCode = 0;
    container.ip = nextIp(docker);
    addProxies(state, container);
    return { ok: true };
  }
  container.last = result.last;
  container.exitCode = result.last.exitCode;
  if (container.restart.name === "no") {
    container.state = "exited";
    container.finishedAt = at;
    container.pastRuns += 1;
  } else {
    container.state = "crashing";
  }
  return { ok: true };
}

/** docker stop. 실행 중이면 SIGTERM으로 정상 종료(0)한 것으로 본다. 반복 종료 중이면 마지막 종료 코드가 남는다. */
export function stopContainer(state: SystemState, container: DockerContainer, manual = true, at = state.clock) {
  const view = containerView(container, at);
  if (view.status === "running" || view.status === "restarting") {
    container.pastRuns = totalRuns(container, at);
    container.exitCode = view.status === "running" ? 0 : view.exitCode;
    container.finishedAt = at;
    container.state = "exited";
  } else if (container.state === "crashing") {
    // on-failure 재시도를 다 쓴 컨테이너: 화면 상태 그대로 굳힌다.
    container.pastRuns = totalRuns(container, at);
    container.finishedAt = view.finishedAt;
    container.state = "exited";
  }
  container.ip = undefined;
  if (manual) container.manuallyStopped = true;
  removeProxies(state, container);
}

export function removeContainer(state: SystemState, container: DockerContainer, force: boolean): { ok: true } | { ok: false; error: string } {
  const status = containerView(container, state.clock).status;
  if ((status === "running" || status === "restarting") && !force) {
    return { ok: false, error: `cannot remove container "/${container.name}": container is ${status}: stop the container before removing or force remove` };
  }
  stopContainer(state, container);
  state.docker!.containers = state.docker!.containers.filter(c => c !== container);
  return { ok: true };
}

/** systemctl stop docker: 실행 중인 컨테이너가 모두 멈춘다(docker-proxy는 서비스와 함께 사라진다). */
export function daemonStopped(state: SystemState) {
  for (const container of state.docker?.containers ?? []) stopContainer(state, container, false);
}

/**
 * systemctl start docker: Docker 문서의 재시작 정책대로 다시 띄운다.
 * always는 손으로 멈췄어도 데몬이 다시 시작하면 뜨고, unless-stopped는 손으로 멈추지 않았을 때만 뜬다.
 */
export function daemonStarted(state: SystemState) {
  for (const container of state.docker?.containers ?? []) {
    const { name } = container.restart;
    if (container.state === "created") continue;
    if (name === "always" || (name === "unless-stopped" && !container.manuallyStopped)) startContainer(state, container);
  }
}
