/**
 * 백엔드(API) 주소. 개발 중에는 비워 두고 같은 주소의 /api를 Vite 프록시가 넘겨 준다.
 * 공개 배포(GitHub Pages)는 빌드할 때 VITE_API_BASE에 백엔드 주소를 넣는다. 공개되는 주소일 뿐 비밀이 아니다.
 * 키는 여기에 절대 넣지 않는다 — 키는 백엔드 .env에만 있다.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "");

/** 공개 배포본인지(백엔드가 운영자 Mac 같은 다른 곳에 있는지). 꺼져 있을 때 안내 문구가 달라진다. */
export const REMOTE_API = API_BASE !== "";

export function apiUrl(path: string): string {
  return API_BASE + path;
}
