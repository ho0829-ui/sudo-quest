/**
 * 불꽃놀이 계산(그리기와 분리한 순수 함수). 로켓이 올라가 터지면 불꽃 알갱이가 사방으로 퍼지고,
 * 중력과 공기 저항으로 떨어지며 사라진다. 꽃가루는 위에서 천천히 흔들리며 내려온다.
 * 난수를 받아 쓰므로 테스트와 "멈춘 한 장면"(동작 줄이기)을 늘 같게 만들 수 있다.
 */
export const COLORS = ["#ff5fa2", "#ffd447", "#5cc8ff", "#7dff9b", "#b48bff", "#ff8a3d", "#ffffff"];

export interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: "spark" | "confetti" | "rocket" }

const GRAVITY = 90;   // px/s²
const DRAG = 0.985;   // 한 프레임(1/60초)당 속도 감쇠
export const MAX_SPARKS = 1600;

/**
 * 화면 아래에서 쏘아 올리는 로켓. 수명(max)이 다하면 그 자리에서 터진다.
 * 가운데에는 축하 카드가 있으므로 주로 양옆에서, 가끔 카드 위쪽 하늘에서 터지게 한다.
 */
export function rocket(width: number, height: number, random: () => number): Spark {
  const side = random();
  const fx = side < 0.4 ? 0.04 + random() * 0.24 : side < 0.8 ? 0.72 + random() * 0.24 : 0.3 + random() * 0.4;
  const x = width * fx;
  const apex = height * (side >= 0.8 ? 0.06 + random() * 0.08 : 0.1 + random() * 0.4);
  const vy = -Math.sqrt(2 * GRAVITY * (height - apex)) * 1.05;
  return { x, y: height, vx: (random() - 0.5) * 40, vy, life: 0, max: (height - apex) / -vy * 1.6, color: COLORS[Math.floor(random() * COLORS.length)], size: 2.2, kind: "rocket" };
}

/** 한 점에서 터지는 불꽃. 두 겹(빠른 바깥 고리·느린 안쪽)으로 퍼져 꽃처럼 보인다. */
export function burst(x: number, y: number, color: string, random: () => number, count = 96): Spark[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.2;
    const speed = (i % 3 ? 190 : 100) * (0.75 + random() * 0.5);
    const tint = i % 5 === 0 ? "#ffffff" : color;
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: 1.4 + random() * 0.9, color: tint, size: 2 + random() * 1.8, kind: "spark" };
  });
}

/** 화면 위에서 떨어지는 꽃가루 한 장. */
export function confetti(width: number, random: () => number): Spark {
  return { x: random() * width, y: -10, vx: (random() - 0.5) * 30, vy: 40 + random() * 50, life: 0, max: 9, color: COLORS[Math.floor(random() * COLORS.length)], size: 3 + random() * 3, kind: "confetti" };
}

/**
 * dt초만큼 진행한다. 수명이 다한 로켓은 터져서 불꽃이 되고, 수명이 다한 불꽃·꽃가루는 사라진다.
 * 개수가 너무 많아지면 오래된 것부터 버려 느려지지 않게 한다.
 */
export function advance(sparks: Spark[], dt: number, random: () => number, height = Infinity): Spark[] {
  const next: Spark[] = [];
  const drag = DRAG ** (dt * 60);
  for (const s of sparks) {
    const life = s.life + dt;
    if (s.kind === "rocket" && life >= s.max) { next.push(...burst(s.x, s.y, s.color, random)); continue; }
    if (life >= s.max || s.y > height + 20) continue;
    if (s.kind === "confetti") {
      next.push({ ...s, life, x: s.x + (s.vx + Math.sin(life * 3) * 25) * dt, y: s.y + s.vy * dt });
      continue;
    }
    // 로켓은 공기 저항을 받지 않아야 계산한 높이까지 올라간다(불꽃만 퍼지다 느려진다).
    const k = s.kind === "rocket" ? 1 : drag;
    const vx = s.vx * k;
    const vy = s.vy * k + GRAVITY * dt;
    next.push({ ...s, life, vx, vy, x: s.x + vx * dt, y: s.y + vy * dt });
  }
  return next.length > MAX_SPARKS ? next.slice(next.length - MAX_SPARKS) : next;
}

/** 정해진 순서의 난수(0~1). 같은 seed면 늘 같은 불꽃이 된다. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** 움직임을 끈 사람에게 보여 줄 멈춘 장면: 불꽃 몇 송이가 활짝 핀 순간. */
export function stillFrame(width: number, height: number): Spark[] {
  const random = seededRandom(7);
  let sparks: Spark[] = [];
  [[0.22, 0.3], [0.5, 0.22], [0.78, 0.32], [0.36, 0.5], [0.66, 0.48]].forEach(([fx, fy], i) =>
    sparks.push(...burst(width * fx, height * fy, COLORS[i % COLORS.length], random, 60)));
  for (let i = 0; i < 24; i++) sparks = advance(sparks, 1 / 60, random);
  return sparks;
}
