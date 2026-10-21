/**
 * 화면 주소(해시 라우트). 브라우저 뒤로/앞으로 가기가 화면 사이를 오가게 한다.
 * GitHub Pages처럼 서버 라우팅이 없는 정적 배포에서도 동작하도록 #/ 형식을 쓴다.
 * 시나리오 ID는 원인을 드러낼 수 있어(예: linux-disk-full) 주소에도 실습 번호만 쓴다.
 */
export type MissionStage = "briefing" | "play" | "report";

export type Route =
  | { kind: "home" }
  | { kind: "knowledge" }
  | { kind: "records" }
  /** 게시판. postId가 있으면 상세, write면 글쓰기(mission이 있으면 그 실습의 회고 양식을 채운다). */
  | { kind: "community"; postId?: number; write?: boolean; mission?: number }
  | { kind: "mission"; no: number; stage: MissionStage };

export function formatRoute(route: Route): string {
  if (route.kind === "community") {
    if (route.write) return route.mission ? `#/community/write/${route.mission}` : "#/community/write";
    return route.postId ? `#/community/${route.postId}` : "#/community";
  }
  if (route.kind !== "mission") return route.kind === "home" ? "#/" : `#/${route.kind}`;
  return route.stage === "briefing" ? `#/mission/${route.no}` : `#/mission/${route.no}/${route.stage}`;
}

/** 모르는 주소는 홈으로. 실습 번호는 1부터 total까지만 받는다. */
export function parseRoute(hash: string, total: number): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "community") {
    if (parts.length === 1) return { kind: "community" };
    if (parts[1] === "write" && parts.length <= 3) {
      const mission = Number(parts[2]);
      // 회고 양식은 있는 실습 번호일 때만 채운다. 이상한 번호면 빈 글쓰기로 연다.
      return /^\d+$/.test(parts[2] ?? "") && mission >= 1 && mission <= total
        ? { kind: "community", write: true, mission } : { kind: "community", write: true };
    }
    const id = Number(parts[1]);
    if (parts.length === 2 && /^\d+$/.test(parts[1]) && Number.isSafeInteger(id) && id > 0) return { kind: "community", postId: id };
    return { kind: "home" };
  }
  if (parts[0] === "knowledge" && parts.length === 1) return { kind: "knowledge" };
  if (parts[0] === "records" && parts.length === 1) return { kind: "records" };
  if (parts[0] === "mission" && /^\d+$/.test(parts[1] ?? "")) {
    const no = Number(parts[1]);
    const stage = parts[2] ?? "briefing";
    if (no >= 1 && no <= total && (stage === "briefing" || stage === "play" || stage === "report") && parts.length <= 3) {
      return { kind: "mission", no, stage };
    }
  }
  return { kind: "home" };
}
