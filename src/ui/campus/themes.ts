/**
 * 방(공간)별 네온 색과 재질. Record<RoomKind, …>라서 새 분류의 색을 빠뜨리면 컴파일이 실패한다. 캠퍼스 지도·실습 화면·지식 화면이 같은 색을 쓴다.
 * 벽·바닥은 빛을 먹는 딥블랙·건메탈로 두고, 색은 선(테두리·랙 틈·바닥 줄)으로만 빛나게 한다.
 */
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
  // 새 방 세 개. 채도는 기존 네온과 맞추고, 화면에서 이웃한 방과 색상(hue)이 겹치지 않게 골랐다.
  // 컨테이너(청록 물빛): 옆 네트워크(보라)·클라우드(하늘)와 구분. 쿠버네티스(놋쇠 금빛): 옆 리눅스(초록)·웹·DB(분홍)와 구분.
  // 커뮤니티(따뜻한 살구): 카페 조명. 경보 주황(#ff7a1a)보다 밝고 붉은 쪽이다.
  docker: { accent: "#26e5c6", floor: "#07161a", grid: "#0e2a2e", wallLeft: "#0c1c1f", wallRight: "#091618" },
  kubernetes: { accent: "#ffd447", floor: "#061528", wallLeft: "#1a130a", wallRight: "#140f08" },
  community: { accent: "#ff9a6b", floor: "#2a190f", wallLeft: "#2e1812", wallRight: "#25130d" },
};

// 분류 이름·태그·운영실 이름은 src/ui/categories.ts에 있다. 여기는 색만 둔다.
