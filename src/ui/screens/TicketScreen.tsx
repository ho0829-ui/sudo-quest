import type { CSSProperties } from "react";
import type { Scenario } from "../../engine/scenario/types";
import { scenarios } from "../../scenarios";
import { CATEGORY_ROOM, CATEGORY_TAG, THEMES } from "../campus/themes";
import { RoomVignette } from "../campus/RoomVignette";

interface TicketScreenProps {
  scenario: Scenario;
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
export function TicketScreen({ scenario, onStart, onBack }: TicketScreenProps) {
  const missionNo = String(scenarios.indexOf(scenario) + 1).padStart(2, "0");
  return (
    <div className="briefing" style={{ "--room": THEMES[scenario.category].accent } as CSSProperties}>
      <div className="briefing-alert" role="status"><span className="alert-beacon" /> INCOMING INCIDENT · 긴급 출동 요청 <span className="alert-stripes" aria-hidden="true" /></div>
      <div className="briefing-grid">
        <section className="briefing-ticket">
          <div className="briefing-meta">
            <span className="briefing-code">TICKET · MISSION {missionNo}</span>
            <span className="briefing-tag">{CATEGORY_TAG[scenario.category]}</span>
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
            <button className="primary" onClick={onStart}>조사 시작</button>
          </div>
        </section>
        <aside className="briefing-site" aria-label={`출동 장소 ${CATEGORY_ROOM[scenario.category]}`}>
          <span className="briefing-code">DEPLOY TO</span>
          <strong>{CATEGORY_ROOM[scenario.category]}</strong>
          <RoomVignette kind={scenario.category} />
        </aside>
      </div>
    </div>
  );
}
