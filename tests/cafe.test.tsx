/**
 * 커뮤니티 카페 장면: 글 → 손님 변환, 평면도(길목이 가구를 뚫지 않는지), 돌아다니기 규칙, 화면 렌더링.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isPostPage, type PostSummary } from "../src/api/community";
import { bubbleWidth, hashName, MAX_VISITORS, outfitOf, shorten, visitorsFrom } from "../src/ui/community/cafe/crowd";
import { BLOCKS, EDGES, FLOOR, NARROW_SPOTS, neighbors, segmentDistance, SPOTS, spot, STANDING, STANDING_RADIUS, startSpots, TABLE_RADIUS, TABLES } from "../src/ui/community/cafe/floor";
import { STAFF } from "../src/ui/community/cafe/staff";
import { facingFor, initialCrowd, step, type Crowd } from "../src/ui/community/cafe/wander";
import { VisitorTag } from "../src/ui/community/cafe/Visitor";

const NOW = Date.parse("2026-10-22T12:00:00Z");
let nextId = 1;
function post(author: string, over: Partial<PostSummary> = {}): PostSummary {
  return { id: nextId++, title: `${author}의 글`, author, category: "question", created_at: "2026-10-20T09:00:00Z",
    excerpt: "", comment_count: 0, spoiler: false, ...over };
}
/** 0, 0.37, 0.74 … 를 돌려주는 정해진 난수. 테스트가 매번 같은 길을 걷게 한다. */
function seeded() { let i = 0; return () => (i++ * 0.37) % 1; }

describe("글 → 손님", () => {
  it("같은 닉네임은 한 사람으로 묶고 가장 최근(목록에서 먼저 나온) 글을 말풍선에 띄운다", () => {
    const list = [post("서버초보", { title: "새 글" }), post("로그탐정"), post("서버초보", { title: "옛 글" })];
    const visitors = visitorsFrom(list, MAX_VISITORS, NOW);
    expect(visitors.map(v => v.author)).toEqual(["서버초보", "로그탐정"]);
    expect(visitors[0]).toMatchObject({ title: "새 글", posts: 2 });
  });

  it("손님은 최대 인원까지만, 빈 닉네임은 익명", () => {
    const list = Array.from({ length: 20 }, (_, i) => post(`user${i}`));
    expect(visitorsFrom(list, 6, NOW)).toHaveLength(6);
    expect(visitorsFrom([post("   ")], MAX_VISITORS, NOW)[0].author).toBe("익명");
  });

  it("하루 안의 글만 새 손님(문으로 들어옴)", () => {
    const [fresh, old] = visitorsFrom([post("a", { created_at: "2026-10-22T08:00:00Z" }), post("b")], MAX_VISITORS, NOW);
    expect(fresh.fresh).toBe(true);
    expect(old.fresh).toBe(false);
  });

  it("말풍선 제목은 글자 단위로 줄이고(한글·이모지가 깨지지 않게) 공백을 정리한다", () => {
    expect(shorten("짧은 제목")).toBe("짧은 제목");
    expect(shorten("아주아주아주 긴 제목이 말풍선에서 잘린다")).toBe("아주아주아주 긴 제목…");
    expect(shorten("☕☕☕☕☕☕☕☕☕☕☕☕☕☕", 4)).toBe("☕☕☕…");
    expect(shorten("  여러   칸\n공백  ")).toBe("여러 칸 공백");
  });

  it("예시 글 표시는 새 서버(true/false)와 예전 서버(필드 없음) 모두 받고, 이상한 값은 거부한다", () => {
    const page = (extra: object) => ({ items: [{ ...post("a"), ...extra }], total: 1, page: 1, page_size: 30 });
    expect(isPostPage(page({ example: true }))).toBe(true);
    expect(isPostPage(page({}))).toBe(true);
    expect(isPostPage(page({ example: "yes" }))).toBe(false);
    expect(visitorsFrom([post("b", { example: true })], MAX_VISITORS, NOW)[0].example).toBe(true);
  });

  it("같은 닉네임은 늘 같은 옷을 입는다", () => {
    expect(outfitOf("커피한잔")).toEqual(outfitOf("커피한잔"));
    expect(hashName("a")).not.toBe(hashName("b"));
    expect(bubbleWidth("ab가", 10)).toBeCloseTo(22);
  });
});

describe("카페 평면도", () => {
  it("모든 자리는 바닥 안에 있고 가구(사각형·테이블) 위가 아니다", () => {
    for (const s of SPOTS) {
      expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(FLOOR.w);
      expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(FLOOR.d);
      for (const [x, y, w, d] of Object.values(BLOCKS)) expect(s.x > x && s.x < x + w && s.y > y && s.y < y + d).toBe(false);
      for (const t of TABLES) expect(Math.hypot(s.x - t[0], s.y - t[1])).toBeGreaterThan(TABLE_RADIUS);
    }
  });

  it("길목 선은 테이블과 가구를 뚫지 않는다", () => {
    for (const [from, tos] of EDGES) for (const to of tos) {
      const a = spot(from), b = spot(to);
      for (const t of TABLES) expect(segmentDistance([a.x, a.y], [b.x, b.y], t)).toBeGreaterThan(TABLE_RADIUS + 0.1);
      for (let k = 0; k <= 20; k++) {
        const [px, py] = [a.x + (b.x - a.x) * k / 20, a.y + (b.y - a.y) * k / 20];
        for (const [x, y, w, d] of Object.values(BLOCKS)) expect(px > x && px < x + w && py > y && py < y + d, `${from}→${to}`).toBe(false);
      }
    }
  });

  it("모든 자리는 서로 이어져 있고, 입구에서 어디든 갈 수 있다", () => {
    const seen = new Set(["door"]);
    const queue = ["door"];
    while (queue.length) for (const n of neighbors(queue.shift()!)) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    expect(seen.size).toBe(SPOTS.length);
  });

  it("스탠딩 테이블도 길목이 비켜 간다", () => {
    for (const [from, tos] of EDGES) for (const to of tos) {
      const a = spot(from), b = spot(to);
      for (const t of STANDING) expect(segmentDistance([a.x, a.y], [b.x, b.y], t)).toBeGreaterThan(STANDING_RADIUS + 0.3);
    }
  });

  it("배경 직원은 손님 자리·길목 선과 겹치지 않는 곳에 있다(걷는 직원은 길 양 끝을 본다)", () => {
    for (const m of STAFF) for (const p of m.walkTo ? [m.at, m.walkTo] : [m.at]) {
      for (const s of SPOTS) expect(Math.hypot(s.x - p[0], s.y - p[1]), `${m.shirt} ↔ ${s.id}`).toBeGreaterThan(0.5);
    }
  });

  it("좁은 화면 구역 안의 자리끼리도 서로 이어져 있다(손님이 화면 밖으로 나가지 않는다)", () => {
    const start = [...NARROW_SPOTS].find(id => id.startsWith("lane"))!;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) for (const n of neighbors(queue.shift()!)) if (NARROW_SPOTS.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
    expect(seen.size).toBe(NARROW_SPOTS.size);
    let crowd: Crowd = initialCrowd(["a", "b", "c"], new Set(), 0, seeded(), NARROW_SPOTS);
    for (let t = 0; t < 120_000; t += 400) crowd = step(crowd, t, seeded(), NARROW_SPOTS);
    expect(Object.values(crowd).every(p => NARROW_SPOTS.has(p.spot))).toBe(true);
  });

  it("처음 자리는 겹치지 않는다", () => {
    const starts = startSpots(14);
    expect(new Set(starts).size).toBe(14);
  });
});

describe("돌아다니기", () => {
  it("쉬는 시간이 지나면 이웃한 빈 자리로 걸어가고, 도착하면 멈춘다", () => {
    const random = seeded();
    let crowd = initialCrowd(["a"], new Set(), 0, random);
    const from = crowd.a.spot;
    crowd = step(crowd, crowd.a.nextAt, random);
    expect(crowd.a.walking).toBe(true);
    expect(neighbors(from)).toContain(crowd.a.spot);
    expect(crowd.a.travelMs).toBeGreaterThan(0);
    crowd = step(crowd, crowd.a.nextAt, random);
    expect(crowd.a.walking).toBe(false);
  });

  it("때가 안 된 손님은 그대로이고, 바뀐 게 없으면 같은 객체(다시 그리지 않음)", () => {
    const crowd = initialCrowd(["a", "b"], new Set(), 0, seeded());
    expect(step(crowd, 1)).toBe(crowd);
  });

  it("오래 걸어도 두 사람이 같은 자리에 서지 않고, 입구로 되돌아가지 않는다", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `v${i}`);
    const random = seeded();
    let crowd: Crowd = initialCrowd(ids, new Set(["v0"]), 0, random);
    for (let t = 0; t < 600_000; t += 400) {
      crowd = step(crowd, t, random);
      const spots = Object.values(crowd).map(p => p.spot);
      expect(new Set(spots).size).toBe(spots.length);
    }
    expect(Object.values(crowd).some(p => p.spot === "door")).toBe(false);
  });

  it("새 글 손님은 문에서 시작한다", () => {
    expect(initialCrowd(["new"], new Set(["new"]), 0, seeded()).new.spot).toBe("door");
  });

  it("화면 아래쪽으로 가면 얼굴이, 위쪽으로 가면 등이 보인다", () => {
    expect(facingFor("lane-1-0", "lane-1-1")).toBe("left");
    expect(facingFor("lane-1-1", "lane-1-0")).toBe("away-right");
    expect(facingFor("lane-0-1", "lane-1-1")).toBe("right");
  });
});

describe("카페 화면", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" }, setInterval, clearInterval });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("말풍선은 그 글로 가는 링크이고, 화면 읽기용 이름에 글쓴이·제목·분류·댓글 수가 있다", async () => {
    const [visitor] = visitorsFrom([post("야간당직", { title: "TLS <체인> 회고", category: "review", comment_count: 3, spoiler: true })], MAX_VISITORS, NOW);
    const placement = initialCrowd([visitor.author], new Set(), 0, seeded())[visitor.author];
    const html = renderToStaticMarkup(<svg><VisitorTag visitor={visitor} placement={placement} active={false} touch={false} large={false} onActive={() => {}} onOpen={() => {}} /></svg>);
    expect(html).toContain(`href="#/community/${visitor.postId}"`);
    expect(html).toContain("야간당직: TLS &lt;체인&gt; 회고 (장애 회고, 댓글 3개)");
    expect(html).not.toContain("<체인>");
  });

  it("카페 장면은 처음에 게시판을 불러오는 중으로 그려진다(서버 응답 전)", async () => {
    const { CafeScene } = await import("../src/ui/community/cafe/CafeScene");
    const html = renderToStaticMarkup(<CafeScene motion party={false} onOpen={() => {}} onWrite={() => {}} />);
    expect(html).toContain("카페 문을 여는 중");
    expect(html).toContain("COMMUNITY LOUNGE");
    expect(html).toContain("오늘의 이야기 —");
  });
});
