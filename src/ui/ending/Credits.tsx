/**
 * 엔딩 크레딧: 영화처럼 위로 흘러가는 화면과 캉캉. 일시정지·빨리 감기(1·2·4·8배)·위치 막대·소리 끄기·닫기(Esc),
 * 휠·↑↓·PageUp/Down·Home/End로 직접 옮길 수도 있다. 움직임을 끈 사람에게는 저절로 흐르지 않는 보통 페이지로 보인다.
 * 내용은 creditRoll.ts에서 오고, 실습 목록은 시나리오 데이터에서 자동으로 만든다.
 */
import { useEffect, useRef } from "react";
import type { Scenario } from "../../engine/scenario/types";
import { CAST, CHAPTERS, GRAVEYARD, MUSIC_CREDIT, rollCall, SPECIAL_GUESTS } from "./creditRoll";
import { Graveyard } from "./Graveyard";
import { music } from "./music";
import { MusicToggle } from "./MusicToggle";
import { useCreditRoll } from "./useCreditRoll";
import { useDialog } from "./useDialog";

export function Credits({ scenarios, motion, onClose }: { scenarios: Scenario[]; motion: boolean; onClose: () => void }) {
  const close = () => { music.stop(); onClose(); };
  const ref = useDialog<HTMLDivElement>(close);
  const scroller = useRef<HTMLDivElement>(null);
  const roll = rollCall(scenarios);
  const flow = useCreditRoll(scroller, motion);

  // 다른 탭으로 가면 음악을 멈추고, 돌아오면 다시 켠다.
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      if (document.hidden && music.playing) { music.stop(); resume = true; }
      else if (!document.hidden && resume) { music.start(); resume = false; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); music.stop(); };
  }, []);

  return <div className="credits" role="dialog" aria-modal="true" aria-label="엔딩 크레딧" ref={ref}>
    <div className="credits-controls">
      {motion && <button type="button" className="ending-button" aria-pressed={!flow.rolling} onClick={flow.toggle}>
        {flow.ended ? "↺ 처음부터" : flow.rolling ? "⏸ 일시정지" : "▶ 이어 보기"}</button>}
      {motion && <button type="button" className="ending-button" onClick={flow.cycleSpeed} aria-label={`빨리 감기, 지금 ${flow.speed}배`}>
        ⏩ {flow.speed}배</button>}
      <MusicToggle />
      <button type="button" className="ending-button" onClick={close}>✕ 닫기</button>
    </div>
    <div className="credits-seek">
      <input type="range" min={0} max={1000} value={flow.progress} aria-label="크레딧 위치" onChange={e => flow.seek(Number(e.target.value))} />
      <span className="credits-keys">휠 · ↑↓ · Space 일시정지</span>
    </div>
    <div className="credits-scroll" ref={scroller} tabIndex={0} aria-label="크레딧 내용">
      <div className="credits-body">
        <div className="credits-gap" />
        <h1 className="credits-logo">SUDO <span>QUEST</span></h1>
        <p className="credits-sub">인프라 장애 대응 퀘스트 — 모든 장애를 해결한 당신에게</p>

        <section><h2>출연</h2>
          {CAST.map(c => <div key={c.name} className="credits-cast">
            <strong>{c.name}</strong><span className="credits-role">{c.role}</span>
            {c.lines.map(line => <p key={line}>{line}</p>)}
          </div>)}
        </section>

        <section><h2>실습 {roll.total}개 · 명령 {roll.commands}종</h2>
          {roll.groups.map(g => <div key={g.label} className="credits-group"><h3>{g.label}</h3>
            {g.titles.map(t => <p key={t}>{t}</p>)}</div>)}
        </section>

        <section><h2>만든 것들</h2>
          {CHAPTERS.map(ch => <div key={ch.title} className="credits-chapter">
            <h3>{ch.title}</h3><span className="credits-role">{ch.credit}</span>
            {ch.lines.map(line => <p key={line}>{line}</p>)}
          </div>)}
        </section>

        <section><h2>특별 출연</h2>{SPECIAL_GUESTS.map(g => <p key={g}>{g}</p>)}</section>
        <section><h2>{MUSIC_CREDIT.title}</h2>{MUSIC_CREDIT.lines.map(l => <p key={l}>{l}</p>)}</section>

        <section><h2>🪦 여기 잠들다</h2>
          <p className="credits-note">만들다가 떠나보낸 것들. 덕분에 지금의 SUDO QUEST가 있습니다.</p>
          <Graveyard tombs={GRAVEYARD} />
        </section>

        <section className="credits-final">
          <p>그리고 —</p>
          <h2>모든 장애를 끝까지 해결한 당신</h2>
          <p className="credits-thanks">Thank you for playing.</p>
          <p className="credits-end">THE END</p>
          <p className="credits-note">…라고 하기엔 다음 실습이 준비 중이에요.</p>
        </section>
        <div className="credits-tail" />
      </div>
    </div>
  </div>;
}
