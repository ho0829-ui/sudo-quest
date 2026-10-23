/**
 * 배경 직원: 카페를 북적이게 하는 사람들. 게시글과 무관하므로 말풍선이 없고 누를 수 없다(글쓴이 손님과 헷갈리지 않게).
 * 대부분 제자리(줄 서기·수다·노트북·발표 듣기)에 있고, 두 명만 정해진 길을 CSS 애니메이션으로 왕복한다.
 * 손님이 다니는 길목·의자와 겹치지 않는 자리에 둔다(테스트로 검사).
 */
import type { Point3 } from "../../campus/iso";
import type { PersonProps } from "../../campus/art/people";
import { LONG_SEAT_Y, STAFF_LONG_SEATS } from "./floor";

export type StaffMember = Omit<PersonProps, "at"> & { at: Point3; /** 앉은 사람 아래에 의자를 그린다 */ stool?: boolean };

const SEATED: Pick<PersonProps, "pose"> = { pose: "sit" };

export const STAFF: StaffMember[] = [
  // 커피 바 앞 주문 줄
  { at: [15.7, 1.95, 0], facing: "away-right", shirt: "#8fb3ff", pants: "#2b3a55", hair: "#2a1d18" },
  { at: [16.6, 2.05, 0], facing: "away-left", shirt: "#e06a6a", pants: "#1d2433", hair: "#6b4a2f", prop: "tablet" },
  // TIL 무대: 발표자와 청중 셋
  { at: [20.3, 1.3, 0.25], facing: "left", shirt: "#326ce5", pants: "#14213d", hair: "#121212", prop: "laptop" },
  { at: [19.3, 3.9, 0], facing: "away-right", ...SEATED, shirt: "#ffd08a", hair: "#3b2a20", stool: true },
  { at: [20.3, 4.1, 0], facing: "away-right", ...SEATED, shirt: "#7fc8a9", hair: "#121212", stool: true },
  { at: [21.3, 3.9, 0], facing: "away-left", ...SEATED, shirt: "#b48bff", hair: "#c98d4b", stool: true },
  // 회의 부스 안(유리 칸막이)
  { at: [15.5, 10.1, 0], facing: "left", ...SEATED, shirt: "#f4f1ea", tie: "#326ce5", hair: "#2a1d18", stool: true },
  { at: [16.9, 10.1, 0], facing: "left", ...SEATED, shirt: "#3a5a40", hair: "#121212", stool: true },
  { at: [16.2, 11.6, 0], facing: "away-right", ...SEATED, shirt: "#ffb3c7", hair: "#6b4a2f", stool: true },
  // 스탠딩 테이블 수다
  { at: [19.4, 7.4, 0], facing: "right", shirt: "#5cc8ff", pants: "#1d2433", hair: "#2a1d18", prop: "mug" },
  { at: [20.6, 6.6, 0], facing: "left", shirt: "#c96a4a", pants: "#2b3a55", hair: "#121212" },
  { at: [19.5, 11.2, 0], facing: "right", shirt: "#f4d28a", pants: "#4a2c1a", hair: "#7a3b1d", prop: "mug" },
  { at: [20.5, 10.4, 0], facing: "left", shirt: "#8fb3ff", pants: "#14181f", hair: "#c98d4b" },
  // 창가 소파
  { at: [0.6, 2.0, 0], facing: "right", ...SEATED, shirt: "#ffd08a", pants: "#4a2c1a", hair: "#2a1d18", prop: "tablet" },
  { at: [0.6, 3.2, 0], facing: "right", ...SEATED, shirt: "#e06a6a", pants: "#2b3a55", hair: "#121212", prop: "mug" },
  // 코르크 게시판을 읽는 사람
  { at: [1.3, 6.2, 0], facing: "away-left", shirt: "#7fc8a9", pants: "#1d2433", hair: "#6b4a2f" },
  { at: [1.5, 7.4, 0], facing: "away-left", shirt: "#f4f1ea", pants: "#3a2f55", hair: "#121212", prop: "mug" },
  // 창가 바
  { at: [1.15, 9.8, 0], facing: "away-left", ...SEATED, shirt: "#b48bff", hair: "#2a1d18", stool: true, prop: "laptop" },
  { at: [1.15, 12.0, 0], facing: "away-left", ...SEATED, shirt: "#ff9a6b", hair: "#c98d4b", stool: true },
  // 장테이블에서 일하는 사람 둘(그 의자는 손님 자리에서 빠져 있다)
  ...STAFF_LONG_SEATS.map(([x, row], i): StaffMember => ({ at: [x, LONG_SEAT_Y[row], 0], facing: row === "north" ? "left" : "away-right",
    ...SEATED, shirt: i ? "#3a1a2c" : "#5eaaff", hair: i ? "#7a3b1d" : "#121212", stool: true, prop: "laptop" })),
  // 지나다니는 사람 둘: 앞쪽 통로와 오른쪽 테이블 사이
  { at: [3.5, 13.3, 0], walkTo: [17.5, 13.3, 0], pose: "walk", facing: "right", shirt: "#ffffff", pants: "#2b3a55", hair: "#3b2a20", prop: "mug", duration: 22, delay: -6 },
  { at: [14.7, 5.95, 0], walkTo: [17.8, 5.95, 0], pose: "walk", facing: "right", shirt: "#f4f1ea", apron: "#3b2a20", hair: "#121212", prop: "mug", duration: 9, delay: -3 },
];
