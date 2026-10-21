/**
 * 아이소메트릭(2.5D) 투영 도우미. 라이브러리 없이 SVG 점 문자열만 만든다.
 *
 * 공간 좌표: x는 화면 오른쪽 아래, y는 왼쪽 아래, z는 위로 향한다. 단위 1 = UNIT px.
 * 화면 좌표는 원점(0,0,0)을 (0,0)으로 둔다. 바깥 <g>에서 translate로 옮겨 쓴다.
 */
export const UNIT = 22;
const COS30 = Math.cos(Math.PI / 6);

export type Point3 = [x: number, y: number, z: number];

export function project([x, y, z]: Point3): [number, number] {
  return [(x - y) * COS30 * UNIT, (x + y) * 0.5 * UNIT - z * UNIT];
}

/** 여러 점을 SVG polygon의 points 문자열로 만든다. 소수점은 한 자리로 줄인다. */
export function points(...corners: Point3[]): string {
  return corners.map(p => project(p).map(v => Math.round(v * 10) / 10).join(",")).join(" ");
}

/** 바닥처럼 높이가 없는 사각형(z 평면). */
export function plane(x: number, y: number, w: number, d: number, z = 0): string {
  return points([x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]);
}

export interface BoxFaces { top: string; left: string; right: string }

/**
 * 직육면체에서 보이는 세 면. 관찰자는 x·y가 큰 쪽(화면 아래)에 있다.
 * left = y+d 면(왼쪽 아래를 봄), right = x+w 면(오른쪽 아래를 봄).
 */
export function box(x: number, y: number, z: number, w: number, d: number, h: number): BoxFaces {
  const t = z + h;
  return {
    top: points([x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]),
    left: points([x, y + d, z], [x + w, y + d, z], [x + w, y + d, t], [x, y + d, t]),
    right: points([x + w, y, z], [x + w, y + d, z], [x + w, y + d, t], [x + w, y, t]),
  };
}

/** 방의 뒷벽 두 장. 왼쪽 벽은 x 평면, 오른쪽 벽은 y 평면이다. */
export function backWalls(x: number, y: number, w: number, d: number, h: number) {
  return {
    left: points([x, y + d, 0], [x, y, 0], [x, y, h], [x, y + d, h]),
    right: points([x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h]),
  };
}

/**
 * 벽면에 붙인 것처럼 보이게 하는 SVG transform.
 * "right" 벽(y 평면)은 글자가 +x 방향, "left" 벽(x 평면)은 -y 방향으로 읽힌다.
 */
export function wallTransform(wall: "left" | "right", at: Point3): string {
  const [px, py] = project(at);
  const slope = wall === "right" ? 0.5 : -0.5;
  return `matrix(${COS30.toFixed(4)},${slope},0,1,${px.toFixed(1)},${py.toFixed(1)})`;
}

/** 바닥에 눕힌 것처럼 보이게 하는 transform. 글자가 +x 방향으로 읽힌다. */
export function floorTransform(at: Point3): string {
  const [px, py] = project(at);
  return `matrix(${COS30.toFixed(4)},0.5,${(-COS30).toFixed(4)},0.5,${px.toFixed(1)},${py.toFixed(1)})`;
}
