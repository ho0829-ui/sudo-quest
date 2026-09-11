import type { Scenario } from "../../engine/scenario/types";

interface TicketScreenProps {
  scenario: Scenario;
  onStart: () => void;
  onBack: () => void;
}

export function TicketScreen({ scenario, onStart, onBack }: TicketScreenProps) {
  return (
    <div className="panel" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="small muted">장애 티켓 #{scenario.id}</div>
      <h2 style={{ margin: "4px 0 0" }}>{scenario.title}</h2>

      <div className="ticket-body">{scenario.ticket}</div>

      <h4 className="small muted" style={{ marginBottom: 6 }}>
        이 시나리오에서 연습할 것
      </h4>
      <ul className="objectives small">
        {scenario.learningObjectives.map((objective, index) => (
          <li key={index}>{objective}</li>
        ))}
      </ul>

      <p className="small muted" style={{ marginTop: 20 }}>
        터미널에서 <code>help</code> 를 입력하면 사용할 수 있는 명령어를 볼 수 있습니다. 원인을
        찾았다고 생각되면 <strong>원인 제출</strong>을, 실제 복구까지 마치면 클리어입니다.
      </p>

      <div className="row end" style={{ marginTop: 20 }}>
        <button onClick={onBack}>목록으로</button>
        <button className="primary" onClick={onStart}>
          조사 시작
        </button>
      </div>
    </div>
  );
}
