import type { CSSProperties } from "react";
import type { Scenario } from "../../engine/scenario/types";
import type { Progress } from "../storage";
import { operatorRank } from "../rank";
import { THEMES } from "../campus/themes";
import { OPEN_CATEGORIES } from "../categories";
import { Icon, type IconName } from "./Icon";
import { BrandMark } from "./BrandLogo";
import { useBoardCount } from "../community/useBoardCount";

export type Workspace = "game" | "knowledge" | "records" | "community";

interface RailProps {
  workspace: Workspace;
  scenarios: Scenario[];
  progress: Progress;
  onNavigate: (next: Workspace) => void;
  onHome: () => void;
}

const MENU: { id: Workspace; label: string; tag: string; icon: IconName }[] = [
  { id: "game", label: "가상 장애 실습", tag: "MISSION MAP", icon: "grid" },
  { id: "knowledge", label: "지식 탐색", tag: "ARCHIVE", icon: "book" },
  { id: "community", label: "커뮤니티 카페", tag: "COMMUNITY", icon: "chat" },
  { id: "records", label: "학습 기록", tag: "SERVICE LOG", icon: "chart" },
];

/**
 * 게임 HUD 같은 왼쪽 레일. 운영자 등급·구역 현황은 모두 실제 진행 기록으로 계산한다.
 */
export function Rail({ workspace, scenarios, progress, onNavigate, onHome }: RailProps) {
  const cleared = scenarios.filter(s => progress[s.id]?.cleared);
  const rank = operatorRank(cleared.length, scenarios.length);
  const xp = cleared.reduce((sum, s) => sum + progress[s.id].bestScore, 0);
  const open = scenarios.length - cleared.length;
  const posts = useBoardCount(workspace);
  // 배지는 짧게(숫자 위주) 두고 뜻은 aria-label로 알린다. 좁은 레일에서도 한 줄에 들어가야 한다.
  const badge: Record<Workspace, { text: string; label: string }> = {
    // 다른 메뉴처럼 실제 숫자(게시글 수)를 단다. 서버가 꺼져 있으면 "–".
    community: posts === null ? { text: "–", label: "게시판 서버 연결 안 됨" } : { text: String(posts), label: `게시글 ${posts}개` },
    game: { text: String(open), label: `미해결 ${open}건` },
    knowledge: { text: "AI", label: "AI 근거 답변" },
    records: { text: String(cleared.length), label: `해결 ${cleared.length}건` },
  };

  return <aside className="app-rail">
    <button className="brand" onClick={onHome} aria-label="SUDO QUEST 홈"><span className="brand-mark"><BrandMark /></span><span className="brand-word">SUDO<span className="brand-accent">QUEST</span><small>INCIDENT RPG</small></span></button>

    <section className="rail-operator" aria-label={`운영자 등급 Lv.${rank.level} ${rank.title}`}>
      <div className="op-avatar"><span>Lv</span>{rank.level}</div>
      <div className="op-text">
        <small>{rank.english}</small>
        <strong>{rank.title}</strong>
        <div className="op-xp" role="progressbar" aria-label="다음 등급까지 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.progress * 100)}>
          <i style={{ width: `${rank.progress * 100}%` }} />
        </div>
        <span>{rank.remaining ? `다음 등급까지 ${rank.remaining}건` : "최고 등급"}</span>
        <span>XP {xp.toLocaleString()}</span>
      </div>
    </section>

    <div className="rail-section-label">CONTROL</div>
    <nav className="rail-nav" aria-label="학습 모드">
      {MENU.map(item => <button key={item.id} aria-label={item.label} aria-current={workspace === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)}>
        <Icon name={item.icon} />
        <span className="nav-text"><span>{item.label}</span><small>{item.tag}</small></span>
        <small className="nav-badge" aria-label={badge[item.id].label}>{badge[item.id].text}</small>
      </button>)}
    </nav>

    <div className="rail-section-label">SECTOR STATUS</div>
    <ul className="sector-status" aria-label="분류별 해결 현황">
      {OPEN_CATEGORIES.map(({ id: kind, tag }) => {
        const own = scenarios.filter(s => s.category === kind);
        const done = own.filter(s => progress[s.id]?.cleared).length;
        return <li key={kind} style={{ "--sector": THEMES[kind].accent } as CSSProperties}>
          <span className={`sector-dot${done < own.length ? " open" : ""}`} />
          <span className="sector-name">{tag}</span>
          <span className="sector-pips" aria-label={`${own.length}개 중 ${done}개 해결`}>
            {own.map((s, i) => <i key={s.id} className={i < done ? "on" : undefined} />)}
          </span>
        </li>;
      })}
    </ul>

    <div className="rail-bottom">
      <div className="rail-shift"><span className="status-dot" /> SANDBOX ONLINE<small>실제 시스템과 분리된 가상 환경</small></div>
    </div>
  </aside>;
}
