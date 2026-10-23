/**
 * 진행 상황 저장 (localStorage).
 *
 * 저장이 실패해도 게임은 그대로 돌아가야 한다.
 * 시크릿 모드, 저장 공간 부족, 브라우저 설정 등으로 얼마든지 막힐 수 있기 때문에
 * 모든 접근을 try/catch로 감싸고 실패하면 조용히 포기한다.
 */

/** 키에 버전을 넣어두면 나중에 저장 형식이 바뀌어도 옛 데이터와 충돌하지 않는다. */
const STORAGE_KEY = "incident-game/v1";

export interface ScenarioProgress {
  cleared: boolean;
  bestScore: number;
  clearedAt: number;
}

export type Progress = Record<string, ScenarioProgress>;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    // 이전 버전이나 손상된 저장값 하나가 전체 학습 화면을 망가뜨리지 않게 한다.
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => {
      if (typeof value !== "object" || value === null) return false;
      const record = value as Partial<ScenarioProgress>;
      return record.cleared === true
        && typeof record.bestScore === "number" && Number.isFinite(record.bestScore)
        && record.bestScore >= 0 && record.bestScore <= 1000
        && typeof record.clearedAt === "number" && Number.isFinite(record.clearedAt)
        && record.clearedAt >= 0;
    }));
  } catch {
    return {};
  }
}

/** 클리어 기록을 남긴다. 이전보다 점수가 높을 때만 갱신한다. */
export function saveClear(scenarioId: string, score: number): Progress {
  const progress = loadProgress();
  const previous = progress[scenarioId];

  const next: Progress = {
    ...progress,
    [scenarioId]: {
      cleared: true,
      bestScore: Math.max(score, previous?.bestScore ?? 0),
      clearedAt: Date.now(),
    },
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장에 실패해도 이번 판은 정상적으로 끝난다
  }
  return next;
}

export function clearProgress(): Progress {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // 파티 시작 연출을 본 기록도 함께 지운다. 다시 다 풀면 연출을 다시 볼 수 있다(ui/party.ts).
    localStorage.removeItem("incident-game/celebrations");
  } catch {
    // 무시
  }
  return {};
}
