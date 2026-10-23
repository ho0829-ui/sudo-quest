import { useState } from 'react';
import type { Session } from '../../engine/session/session';
import { Icon } from './Icon';
import { buildReportMarkdown, loadReflection, saveReflection, reportFilename, REFLECTION_LIMIT, type Reflection } from '../report';
import '../report.css';

const PROMPTS: { key: keyof Reflection; label: string; placeholder: string }[] = [
  { key: 'evidence', label: '원인을 좁힌 결정적 단서', placeholder: '어떤 명령의 어떤 출력이 가설을 뒷받침했나요?' },
  { key: 'improvement', label: '다음에는 다르게 할 점', placeholder: '불필요했던 점검이나 더 먼저 확인할 것을 적어보세요.' },
  { key: 'prevention', label: '재발을 막기 위한 조치', placeholder: '어떤 알림, 자동화, 점검 절차를 추가하면 좋을까요?' },
];

export function InvestigationReview({ session }: { session: Session }) {
  const [reflection, setReflection] = useState(() => loadReflection(session.scenario.id));
  const [saveStatus, setSaveStatus] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const lines = session.lines.filter(line => line.input.trim());
  const nonzero = lines.filter(line => line.exitCode !== 0).length;

  function update(key: keyof Reflection, value: string) {
    const next = { ...reflection, [key]: value };
    setReflection(next);
    const saved = saveReflection(session.scenario.id, next);
    setSaveStatus(saved ? '이 브라우저에 저장됨' : '브라우저에 저장하지 못했습니다. 화면을 떠나기 전에 리포트를 다운로드하세요.');
  }

  function download() {
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      const blob = new Blob([buildReportMarkdown(session, reflection)], { type: 'text/markdown;charset=utf-8' });
      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      anchor.href = url; anchor.download = reportFilename(session);
      document.body.appendChild(anchor); anchor.click();
      setExportStatus('다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인하세요.');
    } catch {
      setExportStatus('다운로드를 시작하지 못했습니다. 브라우저 설정을 확인한 뒤 다시 시도하세요.');
    } finally {
      anchor?.remove();
      // 브라우저가 파일 URL을 읽은 뒤 해제한다.
      if (url) { const objectUrl = url; setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
    }
  }

  return <>
    <section className="panel investigation-review" aria-labelledby="investigation-title">
      <div className="review-heading"><div><span className="eyebrow">OBSERVE → REASON → RESOLVE</span><h2 id="investigation-title">나의 조사 타임라인</h2></div><Icon name="terminal" /></div>
      <p className="small muted">실행 {lines.length}회 · 종료 코드가 0이 아닌 명령 {nonzero}회. 실패 출력도 원인을 좁히는 단서가 됩니다.</p>
      <ol className="investigation-timeline">{lines.map((line, index) => <li key={index}>
        <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span>
        <details><summary><code>{line.input}</code><span className={`exit-code ${line.exitCode === 0 ? '' : 'nonzero'}`}>exit {line.exitCode}</span></summary>
          <p className="small muted">작업 디렉터리: {line.cwd}</p>
          {line.stdout && <pre>{line.stdout}</pre>}
          {line.stderr && <pre className="stderr">{line.stderr}</pre>}
          {!line.stdout && !line.stderr && <p className="small muted">출력 없음</p>}
        </details>
      </li>)}</ol>
      {!lines.length && <p className="small muted">기록된 명령이 없습니다.</p>}
    </section>
    <section className="panel reflection-panel" aria-labelledby="reflection-title">
      <div className="review-heading"><div><span className="eyebrow">MAKE THE EXPERIENCE YOURS</span><h2 id="reflection-title">이번 장애에서 배운 것</h2></div><Icon name="book" /></div>
      <p className="small muted">회고는 시나리오별로 이 브라우저에 저장됩니다. 다시 풀었을 때도 이전 메모를 이어 쓸 수 있습니다.</p>
      {PROMPTS.map(({ key, label, placeholder }) => <label className="reflection-field" key={key}>
        <span>{label}</span><textarea value={reflection[key]} onChange={e => update(key, e.target.value)} rows={3} maxLength={REFLECTION_LIMIT} placeholder={placeholder} />
        <small>{reflection[key].length} / {REFLECTION_LIMIT}</small>
      </label>)}
      <p className="small muted" role="status">{saveStatus}</p>
      <div className="report-export"><div><strong>경험을 기록으로 남기세요.</strong><p className="small muted">점수 · 회고 · 명령과 출력 · 시나리오 해설을 하나의 Markdown 파일로 저장합니다.</p></div>
        <button className="primary" onClick={download}><Icon name="book" size={16} /> 리포트 다운로드</button></div>
      <p className="small muted" role="status">{exportStatus}</p>
    </section>
  </>;
}
