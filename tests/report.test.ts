import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReportMarkdown, EMPTY_REFLECTION, loadReflection, saveReflection, reportFilename, REFLECTION_LIMIT } from '../src/ui/report';
import { createSession, submitCause } from '../src/engine/session/session';
import { execute } from '../src/engine/session/execute';
import { scenarios } from '../src/scenarios';

const now = 1_000_000_000_000;
function completed() {
  let session = createSession(scenarios[0], now);
  for (const command of scenarios[0].solutionPath) session = execute(session, command, now + 30000);
  return submitCause(session, scenarios[0].rootCause.answerId, now + 30000).session;
}
function memoryStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  return data;
}
afterEach(() => vi.unstubAllGlobals());

describe('회고 저장', () => {
  it('시나리오별로 메모를 분리하고 복원한다', () => {
    memoryStorage();
    expect(saveReflection('a', { ...EMPTY_REFLECTION, evidence: 'df -h에서 100%' })).toBe(true);
    expect(loadReflection('a').evidence).toBe('df -h에서 100%');
    expect(loadReflection('b')).toEqual(EMPTY_REFLECTION);
  });
  it('저장 실패를 숨기지 않고 실패 여부를 반환한다', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota'); }, getItem: () => { throw new Error('blocked'); } });
    expect(saveReflection('a', EMPTY_REFLECTION)).toBe(false);
    expect(loadReflection('a')).toEqual(EMPTY_REFLECTION);
  });
  it.each(['{broken', 'null', '[]', '3'])('손상된 저장값 %s를 안전하게 무시한다', raw => {
    const data = memoryStorage(); data.set('incident-game/reflection/v1/a', raw);
    expect(loadReflection('a')).toEqual(EMPTY_REFLECTION);
  });
  it('정상 필드는 살리고 잘못된 필드와 초과 길이는 정리한다', () => {
    const data = memoryStorage(); data.set('incident-game/reflection/v1/a', JSON.stringify({ evidence: 'x'.repeat(4000), prevention: 7, improvement: '먼저 로그 확인' }));
    expect(loadReflection('a')).toEqual({ evidence: 'x'.repeat(REFLECTION_LIMIT), prevention: '', improvement: '먼저 로그 확인' });
  });
});

describe('Markdown 리포트', () => {
  it('완료 점수와 회고, 실제 출력, 해설을 함께 담는다', () => {
    const session = completed();
    const report = buildReportMarkdown(session, { ...EMPTY_REFLECTION, evidence: '100%가 단서였다' });
    expect(report).toContain('1000점 (S)');
    expect(report).toContain('100%가 단서였다');
    expect(report).toContain('No space left on device');
    expect(report).toContain('## 실제 실행 기록');
    expect(report).toContain('## 모범 풀이');
    expect(report).toContain(session.scenario.postmortem.howToPrevent);
    expect(report).not.toContain('answerId');
  });
  it('입력한 백틱과 HTML은 코드 블록 안에 남긴다', () => {
    const report = buildReportMarkdown(completed(), { ...EMPTY_REFLECTION, evidence: '```\n<script>alert(1)</script>\n```' });
    expect(report).toContain('````text\n```\n<script>alert(1)</script>\n```\n````');
  });
  it('빈 입력은 제외하고 출력 없는 실행과 오류 출력은 표시한다', () => {
    const session = completed();
    session.lines = [
      { input: ' ', stdout: 'EXCLUDED', stderr: '', exitCode: 0, cwd: '/' },
      { input: 'sudo rm log', stdout: '', stderr: '', exitCode: 0, cwd: '/' },
      { input: 'missing', stdout: '', stderr: 'command not found', exitCode: 127, cwd: '/tmp' },
    ];
    const report = buildReportMarkdown(session, EMPTY_REFLECTION);
    expect(report).not.toContain('EXCLUDED');
    expect(report).toContain('(출력 없음)');
    expect(report).toContain('종료 코드 127');
    expect(report).toContain('작업 디렉터리: /tmp');
    expect(report).toContain('오류 출력:');
  });
  it('모든 시나리오의 완료 리포트를 만들 수 있다', () => {
    for (const scenario of scenarios) {
      let session = createSession(scenario, now);
      for (const command of scenario.solutionPath) session = execute(session, command, now);
      session = submitCause(session, scenario.rootCause.answerId, now).session;
      const report = buildReportMarkdown(session, EMPTY_REFLECTION);
      expect(report).toContain(scenario.title);
      for (const evidence of scenario.evidence) {
        expect(report).toContain(evidence.title);
        expect(report).toContain(evidence.url);
      }
      expect(reportFilename(session)).toMatch(new RegExp(`^sudo-quest-${scenario.id}-\\d{4}-\\d{2}-\\d{2}-\\d{4}\\.md$`));
    }
  });
  it('리포트 파일 이름은 앱 이름과 읽을 수 있는 날짜·시각(이 컴퓨터 시간대)을 쓴다', () => {
    const at = new Date(2026, 9, 22, 9, 6).getTime();
    let session = createSession(scenarios[0], at);
    for (const command of scenarios[0].solutionPath) session = execute(session, command, at);
    session = submitCause(session, scenarios[0].rootCause.answerId, at).session;
    expect(reportFilename(session)).toBe(`sudo-quest-${scenarios[0].id}-2026-10-22-0906.md`);
  });
});
