/**
 * 캠퍼스의 방 배치와 상태. 방의 경보등은 "아직 풀지 않은 실습이 있다"는 학습 진행 표시일 뿐,
 * 실제 서버 모니터링 값이 아니다.
 */
import type { Category, Scenario } from "../../engine/scenario/types";
import type { Progress } from "../storage";

export type RoomKind = Category | "control" | "library";

export interface RoomInfo {
  kind: RoomKind;
  /** 공간 좌표에서 방의 왼쪽 위 모서리. 방 크기는 ROOM_SIZE × ROOM_SIZE. */
  origin: [number, number];
  name: string;
  tag: string;
  blurb: string;
}

export const ROOM_SIZE = 10;
export const WALL_HEIGHT = 4.2;
// 방 사이 복도 폭 2를 두고 3×3 격자 중 6칸을 다이아몬드 모양으로 쓴다.
const STRIDE = ROOM_SIZE + 2;

export const ROOMS: RoomInfo[] = [
  { kind: "library", origin: [0, 0], name: "자료실", tag: "KNOWLEDGE",
    blurb: "공식 문서 100개 주제를 근거와 함께 찾아보는 곳" },
  { kind: "linux", origin: [0, STRIDE], name: "리눅스 서버실", tag: "SYSTEM",
    blurb: "디스크·메모리·권한·포트처럼 서버 한 대 안에서 생기는 장애" },
  { kind: "network", origin: [STRIDE, 0], name: "네트워크실", tag: "NETWORK",
    blurb: "DNS·방화벽·바인딩처럼 서버 사이 연결이 끊기는 장애" },
  { kind: "control", origin: [STRIDE, STRIDE], name: "관제실", tag: "CONTROL",
    blurb: "지금까지 해결한 장애와 최고 점수를 모아 보는 곳" },
  { kind: "web-db", origin: [STRIDE, STRIDE * 2], name: "웹·DB실", tag: "APPLICATION",
    blurb: "nginx 설정·인증서·DB 연결처럼 서비스 계층의 장애" },
  { kind: "aws", origin: [STRIDE * 2, STRIDE], name: "AWS 클라우드룸", tag: "CLOUD",
    blurb: "보안 그룹·IAM·로드 밸런서처럼 클라우드 설정 장애" },
];

export interface RoomStatus {
  total: number;
  cleared: number;
  /** 풀지 않은 실습이 있으면 경보등을 켠다. 실습이 없는 방(관제실·자료실)은 null. */
  alarm: boolean | null;
}

export function roomStatus(kind: RoomKind, scenarios: Scenario[], progress: Progress): RoomStatus {
  const own = kind === "control" || kind === "library" ? scenarios : scenarios.filter(s => s.category === kind);
  const cleared = own.filter(s => progress[s.id]?.cleared).length;
  const isLab = kind !== "control" && kind !== "library";
  return { total: own.length, cleared, alarm: isLab ? cleared < own.length : null };
}

