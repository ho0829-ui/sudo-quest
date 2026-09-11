/**
 * 게임 세션.
 *
 * "지금 이 시나리오를 푸는 중인 한 판"의 전부를 담는다.
 * React를 모르는 순수 TypeScript라서 브라우저 없이 테스트할 수 있다.
 * UI는 이 함수들을 부르고 결과를 화면에 그리기만 한다.
 */
import { runCommand } from "../run";
import { buildInitialState } from "../scenario/build";
import type { Scenario } from "../scenario/types";
import type { SystemState } from "../state/types";

/** 터미널에 찍힌 한 덩어리 (입력 + 그 결과) */
export interface TerminalLine {
  input: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /**
   * 명령을 실행한 시점의 작업 디렉터리.
   * cd로 옮겨 다녀도 지난 줄은 그때의 프롬프트를 그대로 보여주기 위해 남긴다.
   */
  cwd: string;
}

export interface Session {
  scenario: Scenario;
  state: SystemState;
  /** 터미널 화면에 보여줄 기록 */
  lines: TerminalLine[];
  /** 플레이어가 입력한 명령어만 모은 것 (모범 풀이와 비교할 때 쓴다) */
  commands: string[];
  /** 공개한 힌트 수 (0~3) */
  hintsUsed: number;
  /** 틀리게 고른 원인 보기 id */
  wrongAnswers: string[];
  /** 원인을 맞혔는가 */
  causeSolved: boolean;
  startedAt: number;
  /** 클리어한 시각. 아직이면 undefined */
  finishedAt?: number;
}

export function createSession(scenario: Scenario, now: number = Date.now()): Session {
  return {
    scenario,
    state: buildInitialState(scenario),
    lines: [],
    commands: [],
    hintsUsed: 0,
    wrongAnswers: [],
    causeSolved: false,
    startedAt: now,
  };
}

/**
 * 클리어 조건: 원인을 맞히고 + 실제로 복구까지 해야 한다.
 * 순서는 강제하지 않는다. 실무에서도 원인을 확신하기 전에 조치부터 하는 경우가 많다.
 */
export function isCleared(session: Session): boolean {
  return session.causeSolved && session.scenario.resolution(session.state);
}

/** 클리어 시점을 한 번만 기록한다. */
function stampFinish(session: Session, now: number): Session {
  if (session.finishedAt === undefined && isCleared(session)) {
    return { ...session, finishedAt: now };
  }
  return session;
}

/** 명령어 한 줄을 실행하고 새 세션을 돌려준다. */
export function execute(session: Session, input: string, now: number = Date.now()): Session {
  const result = runCommand(session.state, input, { available: session.scenario.commands });

  const next: Session = {
    ...session,
    state: result.state,
    lines: [
      ...session.lines,
      {
        input,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: session.state.cwd, // 명령 실행 "전"의 위치
      },
    ],
    // 빈 입력은 기록하지 않는다 (엔터만 친 경우)
    commands: input.trim() ? [...session.commands, input.trim()] : session.commands,
  };

  return stampFinish(next, now);
}

/** 다음 힌트를 연다. 이미 다 봤으면 그대로 둔다. */
export function revealHint(session: Session): Session {
  if (session.hintsUsed >= session.scenario.hints.length) return session;
  return { ...session, hintsUsed: session.hintsUsed + 1 };
}

export interface CauseSubmission {
  session: Session;
  correct: boolean;
  /** 틀렸을 때 보여줄 해설 */
  whyWrong?: string;
}

/** 원인 보기를 제출한다. 틀려도 계속 조사할 수 있다. */
export function submitCause(
  session: Session,
  choiceId: string,
  now: number = Date.now(),
): CauseSubmission {
  const { rootCause } = session.scenario;
  const correct = choiceId === rootCause.answerId;

  if (correct) {
    return { session: stampFinish({ ...session, causeSolved: true }, now), correct: true };
  }

  // 같은 오답을 여러 번 골라도 감점은 한 번만 한다
  const alreadyTried = session.wrongAnswers.includes(choiceId);
  const choice = rootCause.choices.find((c) => c.id === choiceId);
  return {
    session: alreadyTried
      ? session
      : { ...session, wrongAnswers: [...session.wrongAnswers, choiceId] },
    correct: false,
    whyWrong: choice?.whyWrong,
  };
}

export function elapsedSeconds(session: Session, now: number = Date.now()): number {
  return Math.max(0, Math.floor(((session.finishedAt ?? now) - session.startedAt) / 1000));
}
