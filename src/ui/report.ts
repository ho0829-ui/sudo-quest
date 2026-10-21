import type { Session } from '../engine/session/session';
import { calculateScore, formatDuration } from '../engine/session/score';

export const REFLECTION_LIMIT = 3000;
export interface Reflection { evidence: string; improvement: string; prevention: string }
export const EMPTY_REFLECTION: Reflection = { evidence: '', improvement: '', prevention: '' };
const reflectionKey = (id: string) => `incident-game/reflection/v1/${id}`;

export function loadReflection(id: string): Reflection {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(reflectionKey(id)) ?? 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...EMPTY_REFLECTION };
    const record = parsed as Record<string, unknown>;
    return Object.fromEntries(Object.keys(EMPTY_REFLECTION).map(key => [key,
      typeof record[key] === 'string' ? record[key].slice(0, REFLECTION_LIMIT) : '',
    ])) as unknown as Reflection;
  } catch { return { ...EMPTY_REFLECTION }; }
}

/** 성공 여부를 UI에 전달한다. 저장이 안 됐는데 저장 완료로 표시하지 않는다. */
export function saveReflection(id: string, reflection: Reflection): boolean {
  try {
    const bounded = Object.fromEntries(Object.entries(reflection).map(([key, value]) => [key, value.slice(0, REFLECTION_LIMIT)]));
    localStorage.setItem(reflectionKey(id), JSON.stringify(bounded));
    return true;
  } catch { return false; }
}

// 사용자가 입력한 백틱이나 HTML이 리포트 구조를 깨지 않도록 원문은 코드 블록으로 보관한다.
function codeBlock(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
  return `${fence}text\n${text}\n${fence}`;
}

export function buildReportMarkdown(session: Session, reflection: Reflection): string {
  const score = calculateScore(session);
  const { scenario } = session;
  const lines = session.lines.filter(line => line.input.trim());
  const blocks = [
    `# SUDO QUEST 실습 리포트 — ${scenario.title}`,
    '브라우저 가상 환경에서 수행한 학습 기록입니다. 실제 서버 작업 기록이 아닙니다.',
    `- 시나리오: ${scenario.id}\n- 점수: ${score.total}점 (${score.grade})\n- 소요 시간: ${formatDuration(score.elapsedSeconds)}\n- 명령어: ${session.commands.length}회\n- 힌트: ${session.hintsUsed}회\n- 오답: ${session.wrongAnswers.length}회`,
    '## 장애 티켓', scenario.ticket,
    '## 나의 회고',
    '### 원인을 좁힌 결정적 단서', codeBlock(reflection.evidence.trim() || '(아직 작성하지 않음)'),
    '### 다음에는 다르게 할 점', codeBlock(reflection.improvement.trim() || '(아직 작성하지 않음)'),
    '### 재발을 막기 위한 조치', codeBlock(reflection.prevention.trim() || '(아직 작성하지 않음)'),
    '## 실제 실행 기록',
    ...lines.flatMap((line, i) => [
      `### ${i + 1}. 명령 실행 · 종료 코드 ${line.exitCode}`,
      codeBlock(`작업 디렉터리: ${line.cwd}\n$ ${line.input}`),
      ...(line.stdout ? ['표준 출력:', codeBlock(line.stdout)] : []),
      ...(line.stderr ? ['오류 출력:', codeBlock(line.stderr)] : []),
      ...(!line.stdout && !line.stderr ? ['(출력 없음)'] : []),
    ]),
    '## 시나리오 해설',
    '### 무슨 일이 있었나', scenario.postmortem.whatHappened,
    '### 왜 생겼나', scenario.postmortem.whyItHappened,
    '### 어떻게 고쳤나', scenario.postmortem.howToFix,
    '### 어떻게 예방하나', scenario.postmortem.howToPrevent,
    ...(scenario.postmortem.realWorldNote ? ['### 실무에서는', scenario.postmortem.realWorldNote] : []),
    '## 모범 풀이', codeBlock(scenario.solutionPath.join('\n')),
  ];
  return blocks.join('\n\n') + '\n';
}

export function reportFilename(session: Session): string {
  const id = session.scenario.id.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `infracoach-${id}-${session.finishedAt ?? session.startedAt}.md`;
}
