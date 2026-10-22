/**
 * 음악 선택(켬/끔·볼륨). 이 브라우저에만 기억하는 편의 기능이라 저장이 막혀도 기본값으로 동작한다.
 */
const ON_KEY = "incident-game/music";
const VOLUME_KEY = "incident-game/music-volume";

/** 처음 볼륨(0~1). 갑자기 큰 소리에 놀라지 않게 작게 시작한다. */
export const DEFAULT_VOLUME = 0.35;

export function loadMusicOn(): boolean {
  try { return localStorage.getItem(ON_KEY) !== "off"; } catch { return true; }
}
export function saveMusicOn(on: boolean) {
  try { localStorage.setItem(ON_KEY, on ? "on" : "off"); } catch { /* 저장이 막혀도 이번 화면에서는 동작 */ }
}

/** 0~1로 자른 볼륨. 저장된 값이 없거나 이상하면 기본값. */
export function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}
export function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    return raw === null ? DEFAULT_VOLUME : clampVolume(Number(raw));
  } catch { return DEFAULT_VOLUME; }
}
export function saveVolume(value: number) {
  try { localStorage.setItem(VOLUME_KEY, String(clampVolume(value))); } catch { /* 무시 */ }
}
