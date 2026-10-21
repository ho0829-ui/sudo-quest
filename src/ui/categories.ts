/**
 * 실습 분류 레지스트리. 화면이 분류에 대해 아는 것(이름·태그·운영실 이름·설명·아이콘·캠퍼스 칸)은
 * 모두 여기서 읽는다. Record<Category, …>라서 엔진에 분류 id를 더하고 여기를 빠뜨리면 컴파일이 실패한다.
 *
 * 캠퍼스는 3×3 격자다. [0,0]은 자료실, [1,1]은 관제실 자리로 예약되어 있고,
 * 남은 칸 [2,0]·[0,2]·[2,2]에 새 운영실을 더 놓을 수 있다(예: 컨테이너 운영실, 쿠버네티스 운영실).
 */
import { CATEGORY_IDS, type Category } from "../engine/scenario/categories";
import type { IconName } from "./components/Icon";

export interface CategoryMeta {
  /** 목록 탭·검색에 쓰는 이름 */
  label: string;
  /** 짧은 영문 태그(전광판·레일·미션 HUD·관제실 화면) */
  tag: string;
  /** 캠퍼스의 운영실 이름 */
  room: string;
  /** 운영실 벽 간판의 영문 표기 */
  wallTag: string;
  /** 방에 마우스를 올렸을 때 보여 줄 설명 */
  blurb: string;
  icon: IconName;
  /** 캠퍼스 격자 칸 [열, 행] */
  slot: readonly [number, number];
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  linux: {
    label: "Linux", tag: "LINUX", room: "리눅스 운영실", wallTag: "SYSTEM", icon: "terminal", slot: [0, 1],
    blurb: "디스크·메모리·권한·포트처럼 서버 한 대 안에서 생기는 장애",
  },
  network: {
    label: "네트워크", tag: "NETWORK", room: "네트워크 운영실", wallTag: "NETWORK", icon: "network", slot: [1, 0],
    blurb: "DNS·방화벽·바인딩처럼 서버 사이 연결이 끊기는 장애",
  },
  "web-db": {
    label: "웹 / DB", tag: "WEB·DB", room: "웹·DB 운영실", wallTag: "APPLICATION", icon: "server", slot: [1, 2],
    blurb: "nginx 설정·인증서·DB 연결처럼 서비스 계층의 장애",
  },
  aws: {
    label: "AWS", tag: "AWS", room: "클라우드 운영실", wallTag: "CLOUD", icon: "cloud", slot: [2, 1],
    blurb: "보안 그룹·IAM·로드 밸런서처럼 클라우드 설정 장애",
  },
};

/** 화면에 늘어놓는 순서는 엔진의 CATEGORY_IDS 순서를 따른다. */
export const CATEGORY_LIST: (CategoryMeta & { id: Category })[] = CATEGORY_IDS.map((id) => ({ id, ...CATEGORIES[id] }));

/** 관제실·자료실이 쓰는 예약 칸 */
export const RESERVED_SLOTS = { library: [0, 0], control: [1, 1] } as const;
export const GRID_SIZE = 3;
