import { describe, expect, it } from "vitest";
import { scenarios } from "../src/scenarios";
import { nextMission } from "../src/ui/nextMission";
import type { Progress } from "../src/ui/storage";

const clear = (ids: string[], score = 900): Progress => Object.fromEntries(ids.map(id => [id, { cleared: true, bestScore: score, clearedAt: 1 }]));

describe("홈의 다음 실습 버튼", () => {
  it("처음에는 첫 실습", () => {
    expect(nextMission(scenarios, {})).toMatchObject({ scenario: scenarios[0], kind: "first", label: "첫 장애 해결하기" });
  });

  it("순서를 건너뛰어 풀어도 이미 해결한 실습이 아니라 앞쪽에 남은 미해결 실습으로 간다", () => {
    const progress = clear([scenarios[0].id, scenarios[4].id, scenarios[11].id, scenarios[23].id]);
    const next = nextMission(scenarios, progress)!;
    expect(next.scenario).toBe(scenarios[1]);
    expect(next.kind).toBe("next");
    expect(progress[next.scenario.id]).toBeUndefined();
  });

  it("어떤 조합으로 풀어도 미해결이 남아 있으면 해결한 실습을 고르지 않는다", () => {
    for (let k = 0; k < scenarios.length; k++) {
      const solved = scenarios.filter((_, i) => i !== k && (i * 7 + k) % 3 !== 0).map(s => s.id);
      const next = nextMission(scenarios, clear(solved))!;
      expect(solved).not.toContain(next.scenario.id);
    }
  });

  it("모두 해결했으면 '다음 실습'이라고 하지 않고 최고 점수가 가장 낮은 실습을 기록 갱신으로 권한다", () => {
    const progress = clear(scenarios.map(s => s.id), 900);
    progress[scenarios[6].id].bestScore = 640;
    const next = nextMission(scenarios, progress)!;
    expect(next).toMatchObject({ scenario: scenarios[6], kind: "improve" });
    expect(next.label).toContain("최고 점수 갱신");
    expect(next.label).not.toContain("다음 실습");
  });

  it("실습이 없으면 버튼이 열 곳도 없다", () => {
    expect(nextMission([], {})).toBeNull();
  });
});
