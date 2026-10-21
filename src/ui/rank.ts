/**
 * 운영자 등급. 해결한 실습 수로만 계산한다(실제 진행 기록 기반, 꾸며 낸 경험치 없음).
 * 실습 수가 늘어나도 맞도록 문턱은 전체 대비 비율로 둔다.
 */
export interface Rank {
  level: number;
  title: string;
  english: string;
  /** 다음 등급까지 남은 해결 수. 최고 등급이면 0 */
  remaining: number;
  /** 지금 등급 안에서 다음 등급까지의 진행률(0~1). 최고 등급이면 1 */
  progress: number;
}

const RANKS = [
  { ratio: 0, title: "수습 엔지니어", english: "TRAINEE" },
  { ratio: 0.08, title: "온콜 루키", english: "ON-CALL ROOKIE" },
  { ratio: 0.23, title: "장애 대응 엔지니어", english: "RESPONDER" },
  { ratio: 0.46, title: "시니어 SRE", english: "SENIOR SRE" },
  { ratio: 0.69, title: "인시던트 커맨더", english: "INCIDENT COMMANDER" },
  { ratio: 1, title: "전설의 온콜", english: "LEGEND" },
];

/** 등급별 최소 해결 수. 실습이 적어도 등급마다 최소 1건씩 차이 나게 한다. */
export function rankThresholds(total: number): number[] {
  const result: number[] = [];
  for (const { ratio } of RANKS) {
    const want = Math.round(ratio * total);
    result.push(result.length === 0 ? 0 : Math.max(want, result[result.length - 1] + 1));
  }
  return result;
}

export function operatorRank(cleared: number, total: number): Rank {
  const thresholds = rankThresholds(total);
  let index = 0;
  while (index + 1 < thresholds.length && cleared >= thresholds[index + 1]) index++;
  const info = RANKS[index];
  const next = thresholds[index + 1];
  if (next === undefined) return { level: index + 1, title: info.title, english: info.english, remaining: 0, progress: 1 };
  const start = thresholds[index];
  return {
    level: index + 1, title: info.title, english: info.english,
    remaining: next - cleared,
    progress: (cleared - start) / (next - start),
  };
}
