import { calculateScore, formatDuration } from "../../engine/session/score";
import type { Session } from "../../engine/session/session";
import type { EvidenceKind } from "../../engine/scenario/types";
import { InvestigationReview } from "../components/InvestigationReview";
import { ExternalLink } from "../components/ExternalLink";
import type { PartyNotice } from "../party";

const EVIDENCE_LABEL: Record<EvidenceKind, string> = { "official-doc": "공식 문서", postmortem: "공개 포스트모템", survey: "업계 조사" };

interface ReportScreenProps {
  session: Session;
  onBackToList: () => void;
  onRetry: () => void;
  /** 커뮤니티 카페에 이 실습의 회고를 남기러 간다(풀이 포함 표시가 켜진 양식). */
  onShare: () => void;
  /** 이 클리어로 운영실 파티가 새로 열렸으면 그 안내. 버튼은 캠퍼스(홈)로 간다. */
  party?: PartyNotice | null;
}

export function ReportScreen({ session, onBackToList, onRetry, onShare, party }: ReportScreenProps) {
  const { scenario, commands } = session;
  const score = calculateScore(session);
  const { postmortem } = scenario;

  // 모범 풀이와 비교할 때, 명령어 이름 + 첫 인자만 보고 "같은 일을 했는지" 판단한다.
  // 완전히 같은 문자열을 요구하면 -n 20 같은 사소한 차이로 다 틀린 게 되어버린다.
  const playerGist = new Set(commands.map(gistOf));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="panel" style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="small muted">복구 완료</div>
        <h2 style={{ margin: "4px 0 12px" }}>{scenario.title}</h2>
        <div className="grade">{score.grade}</div>
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{score.total}점</div>

        <div className="score-grid">
          <ScoreItem label="소요 시간" value={formatDuration(score.elapsedSeconds)} />
          <ScoreItem label="명령어" value={`${commands.length}회`} />
          <ScoreItem label="힌트" value={`${session.hintsUsed}회`} penalty={score.hintPenalty} />
          <ScoreItem label="오답" value={`${session.wrongAnswers.length}회`} penalty={score.wrongPenalty} />
        </div>
        {party && <div className="party-callout" role="status">
          <span>{party.message}</span>
          <button className="primary" onClick={onBackToList}>{party.action}</button>
        </div>}
      </div>

      <InvestigationReview key={session.scenario.id} session={session} />

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>포스트모템</h2>

        <div className="report-section">
          <h3>무슨 일이 있었나</h3>
          <p>{postmortem.whatHappened}</p>
        </div>
        <div className="report-section">
          <h3>왜 생겼나</h3>
          <p>{postmortem.whyItHappened}</p>
        </div>
        <div className="report-section">
          <h3>어떻게 고쳤나</h3>
          <p>{postmortem.howToFix}</p>
        </div>
        <div className="report-section">
          <h3>어떻게 예방하나</h3>
          <p>{postmortem.howToPrevent}</p>
        </div>
        {postmortem.realWorldNote && (
          <div className="report-section">
            <h3>실무에서는</h3>
            <p>{postmortem.realWorldNote}</p>
          </div>
        )}
        {/* 학습 목표는 풀이 방법을 담고 있어 브리핑에서는 숨기고, 클리어 뒤 회고에서 보여 준다. */}
        <div className="report-section">
          <h3>이번 실습에서 익힌 것</h3>
          <ul className="objectives small">
            {session.scenario.learningObjectives.map((objective, index) => <li key={index}>{objective}</li>)}
          </ul>
        </div>
        {/* 근거 자료의 제목에도 원인이 드러나므로 브리핑·코치 요청에는 넣지 않고 여기서만 보여 준다. */}
        <div className="report-section">
          <h3>참고 자료</h3>
          <ul className="evidence-list small">
            {scenario.evidence.map(item => <li key={item.url}>
              <span className="evidence-kind">{EVIDENCE_LABEL[item.kind]}</span>
              <ExternalLink href={item.url}>{item.title}</ExternalLink>
            </li>)}
          </ul>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>내 풀이 vs 모범 풀이</h2>
        <p className="small muted">
          모범 풀이와 다르다고 틀린 건 아닙니다. 어디를 돌아갔는지 비교해 보세요.
        </p>
        <div className="compare">
          <div>
            <h4 className="small muted">내가 입력한 명령어 ({commands.length})</h4>
            <ol>
              {commands.map((command, index) => (
                <li key={index}>{command}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="small muted">모범 풀이 ({scenario.solutionPath.length})</h4>
            <ol>
              {scenario.solutionPath.map((command, index) => (
                <li key={index} className={playerGist.has(gistOf(command)) ? "matched" : ""}>
                  {command}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="row end">
        <button onClick={onRetry}>다시 풀기</button>
        <button onClick={onShare}>커뮤니티에 회고 남기기</button>
        <button className="primary" onClick={onBackToList}>
          다른 시나리오 풀기
        </button>
      </div>
    </div>
  );
}

/** "sudo rm -f /var/log/app.log" → "rm /var/log/app.log" (sudo와 플래그를 뺀 뼈대) */
function gistOf(command: string): string {
  const words = command.trim().split(/\s+/).filter((word) => !word.startsWith("-"));
  if (words[0] === "sudo") words.shift();
  return words.slice(0, 2).join(" ");
}

/** penalty가 없으면 점수와 무관한 기록(시간·명령 수)이라 감점 줄을 그리지 않는다. */
function ScoreItem({ label, value, penalty }: { label: string; value: string; penalty?: number }) {
  return (
    <div className="score-item">
      <div className="small muted">{label}</div>
      <div className="value">{value}</div>
      {penalty !== undefined && <div className="small" style={{ color: penalty ? "var(--red)" : "var(--muted)" }}>
        {penalty > 0 ? `-${penalty}점` : "감점 없음"}
      </div>}
    </div>
  );
}
