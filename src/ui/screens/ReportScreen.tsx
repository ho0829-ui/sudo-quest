import { calculateScore, formatDuration } from "../../engine/session/score";
import type { Session } from "../../engine/session/session";

interface ReportScreenProps {
  session: Session;
  onBackToList: () => void;
  onRetry: () => void;
}

export function ReportScreen({ session, onBackToList, onRetry }: ReportScreenProps) {
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
          <ScoreItem label="소요 시간" value={formatDuration(score.elapsedSeconds)} penalty={score.timePenalty} />
          <ScoreItem label="명령어" value={`${commands.length}회`} penalty={score.commandPenalty} />
          <ScoreItem label="힌트" value={`${session.hintsUsed}회`} penalty={score.hintPenalty} />
          <ScoreItem label="오답" value={`${session.wrongAnswers.length}회`} penalty={score.wrongPenalty} />
        </div>
      </div>

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

function ScoreItem({ label, value, penalty }: { label: string; value: string; penalty: number }) {
  return (
    <div className="score-item">
      <div className="small muted">{label}</div>
      <div className="value">{value}</div>
      <div className="small" style={{ color: penalty > 0 ? "var(--red)" : "var(--muted)" }}>
        {penalty > 0 ? `-${penalty}점` : "감점 없음"}
      </div>
    </div>
  );
}
