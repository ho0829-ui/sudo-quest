import { useEffect, useRef, useState } from "react";
import { complete } from "../../engine/complete";
import { DEFAULT_COMMANDS } from "../../engine/commands";
import type { TerminalLine } from "../../engine/session/session";
import type { SystemState } from "../../engine/state/types";

interface TerminalProps {
  state: SystemState;
  lines: TerminalLine[];
  available?: string[];
  /** 바깥(코치 제안)에서 입력줄에 넣을 명령. nonce가 바뀔 때만 반영한다. */
  draft?: { text: string; nonce: number };
  onSubmit: (input: string) => void;
}

/** "ubuntu@web-01:~$" — 홈 디렉터리는 실제 셸처럼 ~ 로 줄여 쓴다 */
function promptOf(state: SystemState, cwd: string = state.cwd): string {
  const home = `/home/${state.user}`;
  const path = cwd === home ? "~" : cwd.startsWith(`${home}/`) ? `~${cwd.slice(home.length)}` : cwd;
  return `${state.user}@${state.hostname}:${path}$`;
}

export function Terminal({ state, lines, available, draft, onSubmit }: TerminalProps) {
  const [input, setInput] = useState("");
  /** Tab을 눌렀을 때 후보가 여럿이면 화면에 보여줄 목록 */
  const [candidates, setCandidates] = useState<string[]>([]);
  /** 위/아래 방향키로 되짚는 위치. null이면 지금 치고 있는 중 */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const history = lines.map((line) => line.input).filter((text) => text.trim());

  // 새 출력이 생기면 항상 맨 아래로 따라간다
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, candidates]);

  // 제안 명령은 입력줄에 넣기만 한다. 실행 여부는 플레이어가 Enter로 정한다.
  useEffect(() => {
    if (!draft || draft.nonce === 0) return;
    setInput(draft.text);
    setCandidates([]);
    setHistoryIndex(null);
    inputRef.current?.focus();
  }, [draft?.nonce]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // 한글 조합을 확정하는 Enter가 명령 실행까지 일으키지 않게 한다.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      onSubmit(input);
      setInput("");
      setCandidates([]);
      setHistoryIndex(null);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && input.trim()) {
      event.preventDefault(); // Tab의 기본 동작(포커스 이동)을 막는다
      const result = complete(state, input, available ?? DEFAULT_COMMANDS);
      setInput(result.input);
      setCandidates(result.candidates);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    }
  }

  return (
    <div className="terminal" ref={scrollRef} onClick={() => inputRef.current?.focus()}>
      {lines.length === 0 && (
        <pre className="muted">
          {`가상 터미널입니다. 실제 시스템에는 아무 영향이 없습니다.\n'help' 를 입력하면 사용할 수 있는 명령어를 볼 수 있습니다.\n`}
        </pre>
      )}

      {lines.map((line, index) => (
        <div key={index}>
          <pre>
            <span className="prompt">{promptOf(state, line.cwd)}</span> {line.input}
          </pre>
          {line.stdout && <pre>{line.stdout}</pre>}
          {line.stderr && <pre className="stderr">{line.stderr}</pre>}
        </div>
      ))}

      {candidates.length > 0 && <pre className="candidates">{candidates.join("  ")}</pre>}

      <div className="terminal-input-row">
        <span className="prompt">{promptOf(state)}</span>
        <input
          ref={inputRef}
          className="terminal-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
          autoFocus
          aria-label="명령어 입력"
        />
      </div>
    </div>
  );
}
