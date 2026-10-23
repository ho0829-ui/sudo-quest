/**
 * 손님 한 명. 몸(VisitorBody)은 테이블과 앞뒤를 섞어 그리고, 말풍선(VisitorTag)은 늘 맨 위에 그린다.
 * 둘 다 같은 자리로 같은 시간 동안 옮겨 가므로(CSS transition) 함께 움직이는 것처럼 보인다.
 */
import { useRef, type CSSProperties, type MouseEvent } from "react";
import { BOARD_CATEGORIES } from "../../../api/community";
import { project } from "../../campus/iso";
import { Person } from "../../campus/art/people";
import { bubbleWidth, CATEGORY_COLORS, type Visitor } from "./crowd";
import { spot } from "./floor";
import type { Placement } from "./wander";

const FONT = 6.5;
const FONT_LARGE = 10;

function place(p: Placement): CSSProperties {
  const s = spot(p.spot);
  const [x, y] = project([s.x, s.y, 0]);
  return { transform: `translate(${x}px, ${y}px)`, transition: `transform ${p.travelMs}ms linear, opacity .4s` };
}

function seated(p: Placement): boolean {
  return !p.walking && spot(p.spot).kind === "seat";
}

/** 아직 문밖에서 들어오기를 기다리는 손님. 보이지 않고 누를 수도 없다. */
function outside(p: Placement): boolean {
  return !p.walking && spot(p.spot).kind === "door";
}

export function VisitorBody({ visitor, placement }: { visitor: Visitor; placement: Placement }) {
  const { outfit } = visitor;
  return <g className={`cafe-visitor${outside(placement) ? " is-outside" : ""}`} style={place(placement)}>
    <Person at={[0, 0, 0]} facing={placement.facing} pose={placement.walking ? "walk" : seated(placement) ? "sit" : "stand"}
      shirt={outfit.shirt} pants={outfit.pants} hair={outfit.hair} skin={outfit.skin} prop={visitor.category === "question" ? "laptop" : "mug"} />
  </g>;
}

/** 보통 클릭만 화면 안에서 연다. 새 탭으로 여는 클릭은 브라우저에 맡긴다. */
function plainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

interface TagProps {
  visitor: Visitor;
  placement: Placement;
  active: boolean;
  /** 터치 화면: 첫 탭은 미리 보기, 같은 사람을 다시 누르면 글을 연다. */
  touch: boolean;
  /** 좁은 화면: 글자를 키운 말풍선 */
  large: boolean;
  /** 말풍선을 한 줄 높이 더 띄운다. 가까이 선 두 사람의 말풍선이 같은 높이에서 겹치지 않게 번갈아 준다. */
  lift?: boolean;
  onActive: (author: string | null) => void;
  onOpen: (postId: number) => void;
}

/** 말풍선 + 몸 위의 투명한 누름 영역. 글로 가는 링크다(새 탭 열기도 된다). */
export function VisitorTag({ visitor, placement, active, touch, large, lift, onActive, onOpen }: TagProps) {
  const color = CATEGORY_COLORS[visitor.category];
  const text = visitor.short;
  const font = large ? FONT_LARGE : FONT;
  const k = font / FONT;
  const w = bubbleWidth(text, font) + (visitor.fresh ? 25 : 10) * k;
  const top = (seated(placement) ? -54 : -60) - (lift ? 13 * k : 0);
  const label = `${visitor.author}: ${visitor.title} (${BOARD_CATEGORIES[visitor.category]}, 댓글 ${visitor.comments}개${visitor.example ? ", 예시 글" : ""})`;
  const away = outside(placement);
  // 탭하면 click보다 focus가 먼저 와서 이미 "고른" 상태가 된다. 그래서 누르기 시작한 순간에 골라져 있었는지를 따로 기억한다.
  // 키보드 Enter에는 pointerdown이 없으므로 바로 연다.
  const press = useRef<{ wasActive: boolean } | null>(null);
  return <a href={`#/community/${visitor.postId}`} className={`cafe-tag${active ? " is-active" : ""}${away ? " is-outside" : ""}`} style={place(placement)}
    aria-label={label} aria-hidden={away || undefined} tabIndex={away ? -1 : undefined}
    onMouseEnter={() => { if (!touch) onActive(visitor.author); }} onMouseLeave={() => { if (!touch) onActive(null); }}
    onFocus={() => onActive(visitor.author)} onBlur={() => onActive(null)}
    onPointerDown={() => { press.current = { wasActive: active }; }}
    onClick={e => {
      const pressed = press.current;
      press.current = null;
      if (!plainClick(e)) return;
      e.preventDefault();
      if (touch && pressed && !pressed.wasActive) onActive(visitor.author);
      else onOpen(visitor.postId);
    }}>
    <rect x={-9} y={-42} width={18} height={44} fill="transparent" />
    {lift && <line x1={0} y1={top + 4.5 * k} x2={0} y2={top + 13 * k} stroke={color} strokeWidth={0.6} opacity={0.7} />}
    {/* 말풍선은 k배로 키워도 꼬리 끝(0,0)이 머리 위 같은 자리에 오도록 꼬리 기준으로 늘린다. */}
    <g transform={`translate(0,${top}) scale(${k})`}>
      <rect className="cafe-bubble" x={-w / k / 2} y={-11} width={w / k} height={12} rx={5} stroke={color} />
      <path d="M-2.5,0.6 L0,4.5 L2.5,0.6 Z" fill="#fff4e6" stroke={color} strokeWidth={0.8} />
      <rect x={-2.4} y={-0.2} width={4.8} height={1.4} fill="#fff4e6" />
      <circle cx={-w / k / 2 + 4} cy={-5} r={1.6} fill={color} />
      <text className="cafe-bubble-text" x={-w / k / 2 + 7} y={-2.6}>{text}</text>
      {visitor.fresh && <text className="cafe-new" x={w / k / 2 - 3} y={-2.6} textAnchor="end">NEW</text>}
    </g>
  </a>;
}
