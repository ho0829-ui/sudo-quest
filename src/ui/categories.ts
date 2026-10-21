/**
 * 실습 분류 레지스트리. 화면이 분류에 대해 아는 것(이름·태그·운영실 이름·설명·아이콘·캠퍼스 칸)은
 * 모두 여기서 읽는다. Record<Category, …>라서 엔진에 분류 id를 더하고 여기를 빠뜨리면 컴파일이 실패한다.
 *
 * 캠퍼스는 3×3 격자다. [0,0] 자료실, [1,1] 관제실, [2,2] 커뮤니티실은 예약 칸이고 나머지 6칸이 운영실이다.
 * 격자를 더 넓히려면 GRID_SIZE와 바닥 범위(layout.ts)를 함께 늘린다.
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
  /**
   * 방은 캠퍼스에 먼저 지어 두고 실습은 아직 없는 분류. 목록 탭·레일·관제실 화면에서 빠지고
   * 방에는 경보등 대신 "준비 중"이 뜬다. 첫 시나리오를 넣을 때 지운다(테스트가 둘이 어긋나면 실패).
   */
  comingSoon?: boolean;
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
  docker: {
    label: "Docker", tag: "DOCKER", room: "컨테이너 운영실", wallTag: "CONTAINER", icon: "container", slot: [2, 0],
    blurb: "포트 충돌·이미지 캐시·바로 죽는 컨테이너처럼 컨테이너를 띄우고 굴릴 때 생기는 장애", comingSoon: true,
  },
  kubernetes: {
    label: "Kubernetes", tag: "K8S", room: "쿠버네티스 운영실", wallTag: "ORCHESTRATION", icon: "helm", slot: [0, 2],
    blurb: "CrashLoopBackOff·OOMKilled·이미지 풀 실패처럼 파드가 제자리를 못 찾는 장애", comingSoon: true,
  },
};

/** 화면에 늘어놓는 순서는 엔진의 CATEGORY_IDS 순서를 따른다. */
export const CATEGORY_LIST: (CategoryMeta & { id: Category })[] = CATEGORY_IDS.map((id) => ({ id, ...CATEGORIES[id] }));

/** 실습이 열린 분류. 목록 탭·레일·관제실 화면은 이것만 보여 준다. */
export const OPEN_CATEGORIES = CATEGORY_LIST.filter((c) => !c.comingSoon);

/** 관제실·자료실·커뮤니티실이 쓰는 예약 칸 */
export const RESERVED_SLOTS = { library: [0, 0], control: [1, 1], community: [2, 2] } as const;
export const GRID_SIZE = 3;
