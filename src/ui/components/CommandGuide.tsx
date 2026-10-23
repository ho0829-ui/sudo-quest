/**
 * 터미널 아래 명령어 안내(펼침). 평소엔 접혀 있고, 지원하지 않는 명령을 치면 제목이 바뀌며 그 항목이 펼쳐진다.
 * 터미널 출력은 실제 셸처럼 "bash: X: command not found"로 두고, 학습용 설명은 여기서만 한다(CLAUDE.md 5절).
 */
import { useEffect, useRef, useState } from "react";
import { getCommand } from "../../engine/commands";
import "./command-guide.css";
import { lastUnknownCommand, UNSUPPORTED_COMMANDS, unsupportedEntry, usableAlternatives, type UnsupportedCommand } from "../unsupportedCommands";

interface CommandGuideProps {
  available: string[];
  lines: { input: string; stderr: string; exitCode: number }[];
}

function Entry({ entry, available, active }: { entry: UnsupportedCommand; available: string[]; active: boolean }) {
  const alternatives = usableAlternatives(entry, available);
  return <li className={`guide-entry${active ? " is-active" : ""}`}>
    <div className="guide-entry-head"><code>{entry.names.join(" · ")}</code><span>{entry.purpose}</span></div>
    {alternatives.length > 0 && <ul className="guide-alts">{alternatives.map(alt =>
      <li key={alt.command}><code>{alt.command}</code><span>{alt.why}</span></li>)}</ul>}
    {(entry.note || alternatives.length === 0) && <p className="guide-note">
      {entry.note ?? "이 실습에서는 대신 쓸 명령이 없어요. 위 목록의 명령으로 조사할 수 있습니다."}</p>}
  </li>;
}

export function CommandGuide({ available, lines }: CommandGuideProps) {
  const unknown = lastUnknownCommand(lines);
  const unknownEntry = unknown ? unsupportedEntry(unknown) : undefined;
  const [open, setOpen] = useState(false);
  const seen = useRef(lines.length);

  // 새로 "command not found"가 나오면 펼쳐서 그 명령의 안내를 보여 준다(이미 본 줄로는 다시 열지 않는다).
  useEffect(() => {
    if (lines.length === seen.current) return;
    seen.current = lines.length;
    if (unknown) setOpen(true);
  }, [lines.length, unknown]);

  const commands = available.map(name => getCommand(name)).filter(c => c !== undefined);
  const others = UNSUPPORTED_COMMANDS.filter(entry => entry !== unknownEntry);
  const summary = unknown
    ? <>방금 입력한 <code>{unknown}</code>은(는) 이 실습에서 지원하지 않아요 — {unknownEntry ? "대신 쓸 명령 보기" : "쓸 수 있는 명령 보기"}</>
    : <>명령어 안내 · 이 실습에서 쓸 수 있는 명령 {commands.length}개 · 자주 찾는데 여기서는 안 되는 명령</>;

  return <details className={`command-guide${unknown ? " has-unknown" : ""}`} open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>{summary}</summary>
    <div className="guide-body">
      {unknown && <div className="guide-focus">
        {unknownEntry
          ? <ul className="guide-list"><Entry entry={unknownEntry} available={available} active /></ul>
          : <p className="guide-note"><code>{unknown}</code>은(는) {getCommand(unknown)
            ? "다른 실습에서는 쓰지만 이 실습에서는 열려 있지 않은 명령이에요."
            : "이 가상 터미널에 없는 명령이에요."} 아래 목록의 명령으로 같은 조사를 할 수 있어요.</p>}
      </div>}
      <section>
        <h4>이 실습에서 쓸 수 있는 명령</h4>
        <ul className="guide-commands">{commands.map(c => <li key={c.name}>
          <code>{c.usage}</code><span>{c.summary}</span>
          {c.operations && <span className="guide-ops">하위 명령: {c.operations.join(", ")}</span>}
        </li>)}</ul>
        <p className="guide-note">앞에 <code>sudo</code>를 붙이면 root 권한으로 실행돼요. <code>|</code> 파이프와 <code>&gt;</code>·<code>&gt;&gt;</code> 리다이렉션, <code>*</code>는 쓸 수 있고, <code>&amp;&amp;</code>·<code>;</code>로 이어 붙이기, <code>$( )</code>·백틱, <code>&lt;</code> 입력은 아직 지원하지 않아요(한 줄에 명령 하나씩).</p>
      </section>
      <section>
        <h4>자주 찾는데 여기서는 안 되는 명령</h4>
        <ul className="guide-list">{others.map(entry => <Entry key={entry.names[0]} entry={entry} available={available} active={false} />)}</ul>
      </section>
    </div>
  </details>;
}
