/**
 * Docker 정리 규칙: 멈춘 컨테이너, 쓰지 않는 이미지, 빌드 캐시. docker system df의 RECLAIMABLE도 같은 규칙으로 계산한다.
 * "쓰는 이미지"는 실행 여부와 상관없이 컨테이너가 하나라도 참조하는 이미지다(멈춘 컨테이너도 이미지를 붙잡는다).
 */
import type { SystemState } from "../types";
import { removeContainer } from "./lifecycle";
import { containerView } from "./runtime";
import { cacheKB, containerKB, layerKB, releaseLayers, removeCacheFile } from "./storage";
import type { BuildCacheRecord, DockerContainer, DockerImage } from "./types";

export const isDangling = (image: DockerImage) => image.repository === "<none>";
const running = (state: SystemState, c: DockerContainer) => ["running", "restarting"].includes(containerView(c, state.clock).status);

export function imagesInUse(state: SystemState): Set<string> {
  return new Set(state.docker!.containers.map(c => c.imageId));
}

export interface Reclaim { total: number; active: number; sizeKB: number; reclaimKB: number }

/** docker system df의 네 줄. 레이어는 여러 이미지가 공유해도 한 번만 센다. */
export function diskSummary(state: SystemState): { images: Reclaim; containers: Reclaim; cache: Reclaim } {
  const docker = state.docker!;
  const used = imagesInUse(state);
  const allLayers = new Set(docker.images.flatMap(i => i.layers));
  const activeLayers = new Set(docker.images.filter(i => used.has(i.id)).flatMap(i => i.layers));
  const sum = (ids: Iterable<string>) => [...ids].reduce((total, id) => total + layerKB(state, id), 0);
  const containerSizes = docker.containers.map(c => ({ kb: containerKB(state, c), active: running(state, c) }));
  const cache = docker.buildCache.reduce((total, r) => total + cacheKB(state, r), 0);
  return {
    images: { total: docker.images.length, active: docker.images.filter(i => used.has(i.id)).length,
      sizeKB: sum(allLayers), reclaimKB: sum([...allLayers].filter(id => !activeLayers.has(id))) },
    containers: { total: containerSizes.length, active: containerSizes.filter(c => c.active).length,
      sizeKB: containerSizes.reduce((t, c) => t + c.kb, 0), reclaimKB: containerSizes.filter(c => !c.active).reduce((t, c) => t + c.kb, 0) },
    cache: { total: docker.buildCache.length, active: 0, sizeKB: cache, reclaimKB: cache },
  };
}

/** 멈춘(Exited·Created) 컨테이너를 지운다. */
export function pruneContainers(state: SystemState): { ids: string[]; kb: number } {
  const targets = state.docker!.containers.filter(c => !running(state, c));
  let kb = 0;
  for (const container of targets) {
    kb += containerKB(state, container);
    removeContainer(state, container, true);
  }
  return { ids: targets.map(c => c.id), kb };
}

export interface ImageRemoval { lines: string[]; kb: number }

/** 이미지 하나를 지운다(호출 전에 사용 여부를 확인한다). 실제 출력처럼 untagged·deleted 줄을 만든다. */
export function deleteImage(state: SystemState, image: DockerImage, capital = false): ImageRemoval {
  const docker = state.docker!;
  docker.images = docker.images.filter(i => i !== image);
  const freed = releaseLayers(state, image);
  const [untagged, deleted] = capital ? ["Untagged", "Deleted"] : ["untagged", "deleted"];
  return {
    lines: [...(isDangling(image) ? [] : [`${untagged}: ${image.repository}:${image.tag}`]), `${deleted}: sha256:${image.id}`,
      ...freed.map(layer => `${deleted}: sha256:${layer.id}`)],
    kb: freed.reduce((total, layer) => total + layer.kb, 0),
  };
}

/** docker image prune: 기본은 이름 없는(dangling) 이미지만, -a는 컨테이너가 쓰지 않는 모든 이미지. until은 그보다 오래된 것만. */
export function pruneImages(state: SystemState, all: boolean, until?: number): ImageRemoval {
  const used = imagesInUse(state);
  const targets = state.docker!.images.filter(i => !used.has(i.id) && (all || isDangling(i)) && (until === undefined || i.createdAt < until));
  const result: ImageRemoval = { lines: [], kb: 0 };
  for (const image of targets) {
    const removed = deleteImage(state, image);
    result.lines.push(...removed.lines);
    result.kb += removed.kb;
  }
  return result;
}

/** docker builder prune: 기본은 어떤 이미지도 참조하지 않는 캐시만, -a는 전부. */
export function pruneBuildCache(state: SystemState, all: boolean): { records: (BuildCacheRecord & { kb: number })[]; kb: number } {
  const docker = state.docker!;
  const targets = docker.buildCache.filter(r => all || r.dangling).map(r => ({ ...r, kb: cacheKB(state, r) }));
  for (const record of targets) removeCacheFile(state, record);
  docker.buildCache = docker.buildCache.filter(r => !targets.some(t => t.id === r.id));
  return { records: targets, kb: targets.reduce((total, r) => total + r.kb, 0) };
}
