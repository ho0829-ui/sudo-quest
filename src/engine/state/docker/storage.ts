/**
 * Docker가 디스크에 남기는 것(이미지 레이어·컨테이너 쓰기 레이어·로그·빌드 캐시)을 /var/lib/docker 아래 가상 파일로 둔다.
 * 디스크 사용량의 기준은 이 파일들 하나뿐이다. 그래서 df·du·rm과 docker system df가 서로 어긋나지 않는다.
 * 여러 이미지가 같은 레이어(베이스 이미지)를 쓰면 파일은 하나다. 마지막 이미지가 지워질 때 레이어 파일도 지운다.
 */
import { diskUsage, mountFor } from "../derived";
import { findNode, removeNode, writeFile } from "../fs";
import type { SystemState } from "../types";
import { hexId } from "./format";
import type { BuildCacheRecord, DockerContainer, DockerImage } from "./types";

export const DOCKER_ROOT = "/var/lib/docker";
const layerDir = (id: string) => `${DOCKER_ROOT}/overlay2/${id}`;
// 실제 diff는 풀어 둔 파일 트리다. 가상 엔진은 크기만 필요해 숨김 파일 하나로 둔다(ls에는 diff 디렉터리만 보인다).
const layerFile = (id: string) => `${layerDir(id)}/diff/.layer`;
const containerDir = (id: string) => `${DOCKER_ROOT}/containers/${id}`;
const cacheFile = (id: string) => `${DOCKER_ROOT}/buildkit/cache/${id}`;

/** Docker는 10진 단위(1MB = 1,000,000바이트)를 쓰고, 가상 파일 크기는 KiB다. */
export const mbToKB = (mb: number) => Math.max(1, Math.round((mb * 1e6) / 1024));
export const kbToBytes = (kb: number) => kb * 1024;

function fileKB(state: SystemState, path: string): number | undefined {
  const node = findNode(state.fs, path);
  return node?.kind === "file" ? node.sizeKB : undefined;
}

function write(state: SystemState, path: string, sizeKB: number, mtime: number, content = "") {
  writeFile(state.fs, path, { sizeKB, mtime, content });
  // /var/lib/docker는 root만 들어갈 수 있다(실제 기본 권한 710).
  const root = findNode(state.fs, DOCKER_ROOT);
  if (root) root.mode = 0o710;
}

export interface NewImage {
  repository: string;
  tag: string;
  createdAt: number;
  cmd: string[];
  env?: Record<string, string>;
  profile: DockerImage["profile"];
  /** 아래(베이스)부터 위로. 이름이 같은 레이어는 이미지끼리 공유한다. */
  layers: { name: string; sizeMB: number }[];
  /** 같은 이름이 여러 개인 이미지(<none>)의 ID를 서로 다르게 만드는 값 */
  key?: string;
}

export function addImage(state: SystemState, spec: NewImage): DockerImage {
  const layers = spec.layers.map(layer => {
    const id = hexId(`layer:${layer.name}`);
    if (fileKB(state, layerFile(id)) === undefined) write(state, layerFile(id), mbToKB(layer.sizeMB), spec.createdAt);
    return id;
  });
  const image: DockerImage = {
    repository: spec.repository, tag: spec.tag, id: hexId(`image:${spec.key ?? `${spec.repository}:${spec.tag}`}`),
    createdAt: spec.createdAt, cmd: spec.cmd, env: spec.env, profile: spec.profile, layers,
  };
  state.docker!.images.push(image);
  return image;
}

export const layerKB = (state: SystemState, id: string) => fileKB(state, layerFile(id)) ?? 0;
export const imageKB = (state: SystemState, image: DockerImage) => image.layers.reduce((sum, id) => sum + layerKB(state, id), 0);
/** 레이어 파일이 하나라도 사라졌으면 이 이미지로 컨테이너를 띄울 수 없다. */
export const imageIntact = (state: SystemState, image: DockerImage) => image.layers.every(id => fileKB(state, layerFile(id)) !== undefined);

/** 컨테이너의 쓰기 레이어와 json 로그. docker system df의 Containers SIZE는 쓰기 레이어 크기다. */
export function writeContainerFiles(state: SystemState, container: DockerContainer, rwMB: number, logMB: number) {
  write(state, layerFile(container.id), mbToKB(rwMB), container.createdAt);
  write(state, `${containerDir(container.id)}/${container.id}-json.log`, mbToKB(logMB), container.createdAt);
}

export const containerKB = (state: SystemState, container: DockerContainer) => fileKB(state, layerFile(container.id)) ?? 0;
export const containerIntact = (state: SystemState, container: DockerContainer) => fileKB(state, layerFile(container.id)) !== undefined;

export function removeContainerFiles(state: SystemState, container: DockerContainer) {
  removeNode(state.fs, layerDir(container.id));
  removeNode(state.fs, containerDir(container.id));
}

/** 이미지를 목록에서 뺀 뒤 부른다. 다른 이미지가 더 쓰지 않는 레이어만 지우고, 지운 레이어 ID와 크기를 돌려준다. */
export function releaseLayers(state: SystemState, image: DockerImage): { id: string; kb: number }[] {
  const stillUsed = new Set(state.docker!.images.flatMap(i => i.layers));
  return image.layers.filter(id => !stillUsed.has(id)).map(id => {
    const kb = layerKB(state, id);
    removeNode(state.fs, layerDir(id));
    return { id, kb };
  });
}

export function addBuildCache(state: SystemState, record: Omit<BuildCacheRecord, "id"> & { name: string; sizeMB: number }) {
  const id = hexId(`cache:${record.name}`).slice(0, 25);
  write(state, cacheFile(id), mbToKB(record.sizeMB), record.lastUsed);
  state.docker!.buildCache.push({ id, description: record.description, lastUsed: record.lastUsed, dangling: record.dangling });
}

export const cacheKB = (state: SystemState, record: BuildCacheRecord) => fileKB(state, cacheFile(record.id)) ?? 0;
export const removeCacheFile = (state: SystemState, record: BuildCacheRecord) => removeNode(state.fs, cacheFile(record.id));

/** /var/lib/docker가 들어 있는 디스크의 남은 공간 */
export function dockerAvailKB(state: SystemState): number {
  return diskUsage(state, mountFor(state, DOCKER_ROOT).mount).availKB;
}
