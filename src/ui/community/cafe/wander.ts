/**
 * 손님이 카페를 돌아다니는 규칙. 각자 한 자리에서 잠깐 쉬다가(의자면 더 오래) 이웃한 빈 자리로 걸어간다.
 * 다음 자리를 고르는 계산(step)은 순수 함수라 테스트하고, 훅은 시계만 돌린다.
 * 모션을 끄거나 동작 줄이기 설정이면 시계를 멈춰 모두 제자리에 둔다.
 */
import { useEffect, useRef, useState } from "react";
import type { Facing } from "../../campus/art/people";
import { neighbors, spot, startSpots } from "./floor";

export interface Placement {
  spot: string;
  walking: boolean;
  facing: Facing;
  /** 이번 걸음에 걸리는 시간(ms). CSS transition 길이로 쓴다. */
  travelMs: number;
  /** 다음 행동(도착하거나 다시 출발) 시각 */
  nextAt: number;
}
export type Crowd = Record<string, Placement>;

const MS_PER_UNIT = 850;
const TICK_MS = 400;

/** 화면에서 움직이는 방향으로 몸을 돌린다. 화면 위쪽(멀어지는 쪽)으로 가면 등을 보인다. */
export function facingFor(from: string, to: string): Facing {
  const a = spot(from), b = spot(to);
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const right = dx - dy >= 0;
  if (dx + dy < 0) return right ? "away-right" : "away-left";
  return right ? "right" : "left";
}

function restMs(spotId: string, random: () => number): number {
  return spot(spotId).kind === "seat" ? 6000 + random() * 6000 : 2000 + random() * 3000;
}

/** 처음 배치. 새 글(fresh) 손님은 문에서 시작해 바로 걸어 들어온다. */
export function initialCrowd(ids: string[], entering: Set<string>, now: number, random: () => number, allowed?: Set<string>): Crowd {
  const starts = startSpots(ids.length, allowed);
  return Object.fromEntries(ids.map((id, i) => {
    const at = entering.has(id) ? "door" : starts[i];
    const seat = spot(at);
    return [id, { spot: at, walking: false, facing: seat.facing ?? (i % 2 ? "left" : "right"), travelMs: 0,
      nextAt: entering.has(id) ? now + 600 + i * 400 : now + 1500 + random() * 4000 }];
  }));
}

/**
 * 한 번의 시계 틱. 때가 된 손님만 도착하거나 다음 자리로 출발한다. 바뀐 게 없으면 같은 객체를 돌려준다.
 * allowed가 있으면 그 자리로만 간다(좁은 화면에서 보이는 구역 안).
 */
export function step(crowd: Crowd, now: number, random: () => number = Math.random, allowed?: Set<string>): Crowd {
  let next = crowd;
  for (const [id, p] of Object.entries(crowd)) {
    if (now < p.nextAt) continue;
    if (next === crowd) next = { ...crowd };
    if (p.walking) {
      const here = spot(p.spot);
      next[id] = { ...p, walking: false, facing: here.facing ?? p.facing, nextAt: now + restMs(p.spot, random) };
      continue;
    }
    // 다른 사람이 있거나 가는 중인 자리는 피한다. 입구로는 되돌아가지 않는다.
    const taken = new Set(Object.values(next).map(o => o.spot));
    const options = neighbors(p.spot).filter(n => n !== "door" && !taken.has(n) && (!allowed || allowed.has(n)));
    if (!options.length) { next[id] = { ...p, nextAt: now + 1500 }; continue; }
    const to = options[Math.floor(random() * options.length)];
    const a = spot(p.spot), b = spot(to);
    const travelMs = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * MS_PER_UNIT);
    next[id] = { spot: to, walking: true, facing: facingFor(p.spot, to), travelMs, nextAt: now + travelMs };
  }
  return next;
}

/** 손님 목록이 바뀌면(새 글) 새 사람만 문으로 들이고, 이미 있던 사람의 자리는 그대로 둔다. */
function merge(crowd: Crowd, ids: string[], entering: Set<string>, now: number, allowed?: Set<string>): Crowd {
  const fresh = initialCrowd(ids, entering, now, Math.random, allowed);
  const taken = new Set(ids.filter(id => crowd[id]).map(id => crowd[id].spot));
  return Object.fromEntries(ids.map(id => {
    if (crowd[id]) return [id, crowd[id]];
    const p = fresh[id];
    return [id, taken.has(p.spot) && p.spot !== "door" ? { ...p, spot: "door" } : p];
  }));
}

export function useWander(ids: string[], entering: Set<string>, enabled: boolean, allowed?: Set<string>): Crowd {
  const [crowd, setCrowd] = useState<Crowd>(() => initialCrowd(ids, entering, Date.now(), Math.random, allowed));
  const key = ids.join("\n");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setCrowd(current => merge(current, ids, entering, Date.now(), allowed));
  }, [key]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setCrowd(current => step(current, Date.now(), Math.random, allowed)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return crowd;
}
