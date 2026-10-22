import { lazy, Suspense, useState, type CSSProperties } from "react";
import type { Scenario } from "../../engine/scenario/types";
import { scenarios } from "../../scenarios";
import { THEMES } from "../campus/themes";
import { CATEGORIES } from "../categories";
import { TerminalLoader } from "../components/TerminalLoader";
import { questDomain } from '../quest/cast';
import { nextPresentation, type QuestPresentation } from '../quest/presentation';
import { RoomVignette } from "../campus/RoomVignette";

const QuestBriefing = lazy(() => import('../quest/QuestBriefing').then(m => ({ default: m.QuestBriefing })));

interface TicketScreenProps {
  scenario: Scenario;
  motion?: boolean;
  /** 같은 실습을 하다 나왔으면 이어서 하기 */
  resumable?: boolean;
  onStart: () => void;
  onBack: () => void;
}

const LEVELS = ["", "입문", "중급", "고급"];
const FLOW: [string, string][] = [
  ["증상 확인", "티켓의 증상을 서버에서 직접 재현해 본다"],
  ["범위 좁히기", "어느 서비스·자원·구간의 문제인지 좁힌다"],
  ["가설과 검증", "의심 원인을 세우고 로그·설정·상태로 확인한다"],
  ["조치와 재발 방지", "고친 뒤 정말 복구됐는지, 다시 안 생기려면 무엇을 바꿀지 본다"],
];

/**
 * 출동 브리핑. 티켓에는 증상만 있고 원인은 없다.
 * 시나리오 ID(예: linux-disk-full)는 원인을 드러내므로 화면에 쓰지 않고 실습 번호만 쓴다.
 */
export function TicketScreen({ scenario, resumable, onStart, onBack, motion = true }: TicketScreenProps) {
  const [talking, setTalking] = useState<QuestPresentation | null>(null);
  const domain = questDomain(scenario.category, scenario.commands);
  const openBriefing = () => setTalking(nextPresentation(domain));
  const missionNo = String(scenarios.indexOf(scenario) + 1).padStart(2, "0");
  return (
    <div className="briefing" style={{ "--room": THEMES[scenario.category].accent } as CSSProperties}>
      {talking && <Suspense fallback={<TerminalLoader label="퀘스트 담당자와 연결 중…" />}><QuestBriefing key={talking.take} presentation={talking} domain={domain} onReplay={openBriefing} title={scenario.title} ticket={scenario.ticket} room={CATEGORIES[scenario.category].room}
        accent={THEMES[scenario.category].accent} mission={missionNo} motion={motion}
        onClose={() => setTalking(null)} onAccept={() => { setTalking(null); onStart(); }} /></Suspense>}
      <div className="briefing-alert" role="status"><span className="alert-beacon" /> INCOMING INCIDENT · 긴급 출동 요청 <span className="alert-stripes" aria-hidden="true" /></div>
      <div className="briefing-grid">
        <section className="briefing-ticket">
          <div className="briefing-meta">
            <span className="briefing-code">TICKET · MISSION {missionNo}</span>
            <span className="briefing-tag">{CATEGORIES[scenario.category].tag}</span>
            <span className="briefing-level" aria-label={`난이도 ${LEVELS[scenario.difficulty]}`}>
              {[1, 2, 3].map(n => <i key={n} className={n <= scenario.difficulty ? "on" : undefined} />)} {LEVELS[scenario.difficulty]}
            </span>
          </div>
          <h2>{scenario.title}</h2>
          <div className="ticket-body">{scenario.ticket}</div>
          {/* 시나리오별 학습 목표는 풀이(예: "df와 du로…")를 담고 있어 여기서 보여 주면 원인이 드러난다.
              브리핑에는 모든 임무에 공통인 조사 흐름만 두고, 학습 목표는 클리어 리포트에서 보여 준다. */}
          <h4>조사 흐름</h4>
          <ol className="investigation-flow">
            {FLOW.map(([step, hint]) => <li key={step}><strong>{step}</strong><span>{hint}</span></li>)}
          </ol>
          <p className="briefing-rules">
            터미널에서 <code>help</code>로 쓸 수 있는 명령을 확인하세요. 원인을 찾았다면 <strong>원인 제출</strong>,
            실제 복구까지 마치면 임무 완료입니다. 실제 시스템에는 아무 영향이 없습니다.
          </p>
          <div className="row end">
            <button onClick={onBack}>목록으로</button>
            <button className="primary" onClick={() => resumable ? onStart() : openBriefing()}>{resumable ? "조사 이어서 하기" : "조사 시작"}</button>
          </div>
        </section>
        <aside className="briefing-site" aria-label={`출동 장소 ${CATEGORIES[scenario.category].room}`}>
          <span className="briefing-code">DEPLOY TO</span>
          <strong>{CATEGORIES[scenario.category].room}</strong>
          <RoomVignette kind={scenario.category} />
        </aside>
      </div>
    </div>
  );
}
