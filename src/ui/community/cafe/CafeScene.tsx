/**
 * 커뮤니티 카페 장면(게시판 목록 위). 최근에 글을 쓴 사람들이 손님이 되어 돌아다니고, 머리 위 말풍선에 글 제목이 뜬다.
 * 손님을 누르면 그 글이 열린다. 아래 게시글 목록이 같은 내용을 글로 모두 담고 있어, 장면은 둘러보는 입구 역할이다.
 * 아이소메트릭은 뒤→앞 순서로 그려야 겹침이 맞으므로, 테이블·의자·화분·손님을 깊이(x+y)로 정렬해 그린다.
 */
import { useMemo, useState } from "react";
import { BOARD_CATEGORIES, isPostPage } from "../../../api/community";
import { project } from "../../campus/iso";
import { PartyContext } from "../../campus/party/context";
import { BoardTime, ExampleTag, useBoard } from "../shared";
import { CafeBack } from "./CafeRoom";
import { BUBBLE_CHARS, BUBBLE_CHARS_NARROW, MAX_VISITORS, MAX_VISITORS_NARROW, visitorsFrom } from "./crowd";
import { NARROW_SPOTS, spot } from "./floor";
import { cafeDrawables } from "./furniture";
import { VisitorBody, VisitorTag } from "./Visitor";
import { useWander } from "./wander";
import "./cafe.css";

const VIEW_BOX = "-275 -104 702 508";
// 좁은 화면은 카페 전체를 담으면 사람이 너무 작아져서 가운데(커피 바·장테이블 쪽)만 잘라 보여 준다.
const VIEW_BOX_NARROW = "-150 -78 410 352";
const ENTERING = 2;
const media = (query: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;

interface CafeSceneProps {
  /** 앱의 모션 설정. 꺼져 있으면 손님이 제자리에 머문다. */
  motion: boolean;
  /** 모든 운영실을 해결했으면 카페도 파티 중(고깔모자·케이크) */
  party: boolean;
  onOpen: (postId: number) => void;
  onWrite: () => void;
}

export function CafeScene({ motion, party, onOpen, onWrite }: CafeSceneProps) {
  const latest = useBoard("/posts?page=1&page_size=30", isPostPage);
  const [env] = useState(() => ({ narrow: media("(max-width: 520px)"), touch: media("(hover: none)"), reduced: media("(prefers-reduced-motion: reduce)") }));
  const visitors = useMemo(() => visitorsFrom(latest.data?.items ?? [], env.narrow ? MAX_VISITORS_NARROW : MAX_VISITORS, Date.now(),
    env.narrow ? BUBBLE_CHARS_NARROW : BUBBLE_CHARS), [latest.data, env.narrow]);
  const moving = motion && !env.reduced;
  // 새 글 손님 중 가장 최근 두 명만 문으로 걸어 들어온다(여럿이면 문 앞에 줄을 서 버린다).
  // 모션이 꺼져 있으면 걸어 들어올 수 없으므로 모두 자리에서 시작한다.
  const entering = useMemo(() => new Set(moving ? visitors.filter(v => v.fresh).slice(0, ENTERING).map(v => v.author) : []), [visitors, moving]);
  const crowd = useWander(visitors.map(v => v.author), entering, moving, env.narrow ? NARROW_SPOTS : undefined);
  const [active, setActive] = useState<string | null>(null);
  const focused = visitors.find(v => v.author === active) ?? null;

  // 깊이 정렬: 가구·배경 직원(furniture.tsx)과 손님을 바닥 위치(x+y) 순서로 그린다.
  const drawables = [
    ...cafeDrawables(party),
    ...visitors.filter(v => crowd[v.author]).map(v => {
      const s = spot(crowd[v.author].spot);
      return { depth: s.x + s.y + 0.01, node: <VisitorBody key={v.author} visitor={v} placement={crowd[v.author]} /> };
    }),
  ].sort((a, b) => a.depth - b.depth);

  const [signX, signY] = project([10.1, 5.2, 1.9]);
  const status = latest.error ? "offline" : latest.loading ? "loading" : visitors.length ? "open" : "empty";
  return <section className="cafe-scene" aria-label="커뮤니티 카페 둘러보기">
    <svg className={`cafe-map${moving ? "" : " is-still"}`} viewBox={env.narrow ? VIEW_BOX_NARROW : VIEW_BOX} role="group"
      aria-label={`카페 손님 ${visitors.length}명. 손님을 고르면 그 사람이 쓴 최근 글이 열립니다.`}>
      <PartyContext.Provider value={party}>
        <CafeBack total={latest.data?.total ?? null} />
        {drawables.map(d => d.node)}
      </PartyContext.Provider>
      {/* 말풍선은 앞(아래)에 선 사람 것이 위에 오도록 깊이 순서로 그린다. */}
      {visitors.filter(v => crowd[v.author]).map((v, i) => ({ v, i, depth: spot(crowd[v.author].spot).x + spot(crowd[v.author].spot).y }))
        .sort((a, b) => a.depth - b.depth).map(({ v, i }) => <VisitorTag key={v.author} visitor={v} placement={crowd[v.author]} lift={i % 2 === 1}
          active={active === v.author} touch={env.touch} large={env.narrow} onActive={setActive} onOpen={onOpen} />)}
      {(status === "empty" || status === "offline") && <g transform={`translate(${signX},${signY})`}>
        {status === "empty"
          ? <a href="#/community/write" onClick={e => { e.preventDefault(); onWrite(); }} aria-label="첫 이야기 남기기">
              <rect className="cafe-sign" x={-58} y={-12} width={116} height={18} rx={4} />
              <text className="cafe-sign-text" y={0.5} textAnchor="middle">첫 이야기를 남겨 주세요 ✎</text></a>
          : <g><rect className="cafe-sign" x={-48} y={-12} width={96} height={18} rx={4} />
              <text className="cafe-sign-text" y={0.5} textAnchor="middle">카페 서버 준비 중</text></g>}
      </g>}
    </svg>
    <div className="cafe-caption" aria-live="polite">
      {focused ? <>
        <span className={`board-tag ${focused.category}`}>{BOARD_CATEGORIES[focused.category]}</span>
        {focused.example && <ExampleTag />}
        <strong>{focused.title}</strong>
        <span className="cafe-caption-meta">{focused.author} · <BoardTime value={focused.createdAt} /> · 댓글 {focused.comments}
          {focused.posts > 1 && ` · 최근 글 ${focused.posts}개`}</span>
        <a className="cafe-caption-open" href={`#/community/${focused.postId}`} onClick={e => { e.preventDefault(); onOpen(focused.postId); }}>
          {env.touch ? "한 번 더 누르거나 여기를 눌러 글 열기 →" : "글 열기 →"}</a>
      </> : <p>{status === "loading" ? "카페 문을 여는 중이에요…"
        : status === "offline" ? "게시판 서버에 연결되지 않아 손님이 아직 없어요. 아래에서 다시 불러올 수 있어요."
        : status === "empty" ? "아직 손님이 없어요. 첫 이야기를 남기면 카페에 들어옵니다."
        : `최근 글을 쓴 ${visitors.length}명이 카페에 있어요. ${env.touch ? "손님을 누르면 글 제목을, 한 번 더 누르면 글을 열어요." : "손님이나 말풍선을 누르면 그 글이 열려요."}`}</p>}
    </div>
  </section>;
}
