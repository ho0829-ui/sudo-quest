import { describe, expect, it } from "vitest";
import {
  createSession,
  elapsedSeconds,
  isCleared,
  revealHint,
  submitCause,
} from "../src/engine/session/session";
import { execute } from "../src/engine/session/execute";
import { calculateScore, formatDuration } from "../src/engine/session/score";
import { complete } from "../src/engine/complete";
import { linuxDiskFull } from "../src/scenarios/linux-disk-full";

const T0 = 1_000_000_000_000; // 테스트에서 시간을 고정하기 위한 기준 시각

/** 모범 풀이를 그대로 실행한 세션을 만든다 */
function solvedSession(now = T0) {
  let session = createSession(linuxDiskFull, T0);
  for (const input of linuxDiskFull.solutionPath) session = execute(session, input, now);
  return submitCause(session, linuxDiskFull.rootCause.answerId, now).session;
}

describe("세션", () => {
  it("시작하면 아직 클리어가 아니다", () => {
    const session = createSession(linuxDiskFull, T0);
    expect(isCleared(session)).toBe(false);
    expect(session.commands).toHaveLength(0);
  });

  it("명령을 실행하면 기록과 상태가 함께 쌓인다", () => {
    let session = createSession(linuxDiskFull, T0);
    session = execute(session, "df -h", T0);
    expect(session.commands).toEqual(["df -h"]);
    expect(session.lines[0].stdout).toContain("Filesystem");
  });

  it("엔터만 친 것은 명령어 수에 세지 않는다", () => {
    let session = createSession(linuxDiskFull, T0);
    session = execute(session, "   ", T0);
    expect(session.commands).toHaveLength(0);
  });

  it("원인만 맞히고 복구를 안 하면 클리어가 아니다", () => {
    const session = createSession(linuxDiskFull, T0);
    const { session: after, correct } = submitCause(session, linuxDiskFull.rootCause.answerId, T0);
    expect(correct).toBe(true);
    expect(after.causeSolved).toBe(true);
    expect(isCleared(after)).toBe(false); // 아직 nginx가 죽어 있다
  });

  it("복구만 하고 원인을 제출 안 해도 클리어가 아니다", () => {
    let session = createSession(linuxDiskFull, T0);
    for (const input of linuxDiskFull.solutionPath) session = execute(session, input, T0);
    expect(linuxDiskFull.resolution(session.state)).toBe(true);
    expect(isCleared(session)).toBe(false);
  });

  it("원인 + 복구를 모두 하면 클리어된다", () => {
    expect(isCleared(solvedSession())).toBe(true);
  });

  it("틀린 원인을 고르면 해설이 나오고, 조사는 계속할 수 있다", () => {
    const session = createSession(linuxDiskFull, T0);
    const result = submitCause(session, "oom", T0);
    expect(result.correct).toBe(false);
    expect(result.whyWrong).toContain("OOM");
    expect(result.session.wrongAnswers).toEqual(["oom"]);
  });

  it("같은 오답을 반복해도 감점은 한 번만 한다", () => {
    let session = createSession(linuxDiskFull, T0);
    session = submitCause(session, "oom", T0).session;
    session = submitCause(session, "oom", T0).session;
    expect(session.wrongAnswers).toEqual(["oom"]);
  });

  it("힌트는 3개까지만 열린다", () => {
    let session = createSession(linuxDiskFull, T0);
    for (let i = 0; i < 5; i++) session = revealHint(session);
    expect(session.hintsUsed).toBe(3);
  });

  it("클리어하면 시간이 멈춘다", () => {
    const session = solvedSession(T0 + 60_000);
    expect(session.finishedAt).toBe(T0 + 60_000);
    // 클리어 후 한참 뒤에 물어봐도 경과 시간은 그대로다
    expect(elapsedSeconds(session, T0 + 600_000)).toBe(60);
  });
});

describe("점수", () => {
  it("빠르고 깔끔하게 풀면 높은 점수를 준다", () => {
    const score = calculateScore(solvedSession(T0 + 120_000), T0 + 120_000);
    expect(score.timePenalty).toBe(20); // 2분
    expect(score.hintPenalty).toBe(0);
    expect(score.wrongPenalty).toBe(0);
    expect(score.grade).toBe("S");
  });

  it("힌트와 오답이 감점된다", () => {
    let session = createSession(linuxDiskFull, T0);
    session = revealHint(revealHint(session));
    session = submitCause(session, "oom", T0).session;
    const score = calculateScore(session, T0);
    expect(score.hintPenalty).toBe(120);
    expect(score.wrongPenalty).toBe(80);
    expect(score.total).toBe(800);
  });

  it("시간 감점에는 상한이 있다", () => {
    const session = createSession(linuxDiskFull, T0);
    const score = calculateScore(session, T0 + 10 * 3600_000);
    expect(score.timePenalty).toBe(200);
  });

  it("점수는 0 아래로 내려가지 않는다", () => {
    let session = createSession(linuxDiskFull, T0);
    session = revealHint(revealHint(revealHint(session)));
    for (const id of ["oom", "port-conflict", "config-error"]) {
      session = submitCause(session, id, T0).session;
    }
    const score = calculateScore(session, T0 + 10 * 3600_000);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });

  it("시간을 사람이 읽는 형식으로 바꾼다", () => {
    expect(formatDuration(45)).toBe("45초");
    expect(formatDuration(125)).toBe("2분 5초");
  });
});

describe("Tab 자동완성", () => {
  const session = createSession(linuxDiskFull, T0);

  it("명령어 이름을 완성한다", () => {
    expect(complete(session.state, "journ").input).toBe("journalctl ");
  });

  it("sudo 뒤에서도 명령어를 완성한다", () => {
    expect(complete(session.state, "sudo system").input).toBe("sudo systemctl ");
  });

  it("후보가 여럿이면 공통 부분까지만 채우고 목록을 준다", () => {
    const result = complete(session.state, "d");
    expect(result.candidates).toEqual(["df", "du"]);
    expect(result.input).toBe("d"); // df와 du의 공통 부분은 "d" 뿐
  });

  it("파일 경로를 완성한다", () => {
    expect(complete(session.state, "cat /var/log/sys").input).toBe("cat /var/log/syslog ");
  });

  it("디렉터리는 뒤에 /를 붙여 계속 파고들게 한다", () => {
    expect(complete(session.state, "ls /var/lo").input).toBe("ls /var/log/");
  });

  it("맞는 후보가 없으면 입력을 그대로 둔다", () => {
    expect(complete(session.state, "cat /var/log/zzz").input).toBe("cat /var/log/zzz");
  });
});
