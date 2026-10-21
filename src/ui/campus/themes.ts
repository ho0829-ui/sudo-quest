/**
 * 방(공간)별 네온 색과 재질. 캠퍼스 지도·실습 화면·지식 화면이 같은 색을 쓴다.
 * 벽·바닥은 빛을 먹는 딥블랙·건메탈로 두고, 색은 선(테두리·랙 틈·바닥 줄)으로만 빛나게 한다.
 */
import type { Category } from "../../engine/scenario/types";
import type { RoomKind } from "./rooms";

export interface RoomTheme {
  accent: string;
  floor: string;
  grid?: string;
  wallLeft: string;
  wallRight: string;
}

export const THEMES: Record<RoomKind, RoomTheme> = {
  linux: { accent: "#00ff66", floor: "#0b120e", grid: "#132a1c", wallLeft: "#0f1813", wallRight: "#0b130e" },
  network: { accent: "#a259ff", floor: "#0e0b18", grid: "#1f1836", wallLeft: "#151022", wallRight: "#100c1a" },
  "web-db": { accent: "#ff2d95", floor: "#140a10", grid: "#2a1020", wallLeft: "#1c0e17", wallRight: "#150a11" },
  aws: { accent: "#5cc8ff", floor: "#091520", grid: "#0f2a3c", wallLeft: "#5cc8ff12", wallRight: "#5cc8ff0b" },
  control: { accent: "#2f7bff", floor: "#080d19", grid: "#16264a", wallLeft: "#0e1526", wallRight: "#0a101e" },
  library: { accent: "#ffcf8a", floor: "#241a12", wallLeft: "#15151b", wallRight: "#101015" },
};

/** 실습 분류 이름표. 지도·전광판·사이드바가 같이 쓴다. */
export const CATEGORY_TAG: Record<Category, string> = { linux: "LINUX", network: "NETWORK", "web-db": "WEB·DB", aws: "AWS" };
export const CATEGORY_ROOM: Record<Category, string> = { linux: "리눅스 서버실", network: "네트워크실", "web-db": "웹·DB실", aws: "AWS 클라우드룸" };
