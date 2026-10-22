/**
 * ulimit: 이 셸의 자원 한도(bash 내장 명령). 로그인 셸은 /etc/security/limits.conf(PAM)의 nofile 값을 받는다.
 * 하지만 systemd 서비스는 PAM을 거치지 않으므로 이 값과 서비스 한도는 다르다. 이 차이가 실무에서 흔한 함정이다.
 * 바꾼 값은 이 셸에만 적용되고 이미 떠 있는 서비스에는 아무 영향이 없다.
 */
import { findNode } from "../state/fs";
import type { SystemState } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

/** 로그인 셸의 nofile: limits.conf의 사용자(또는 *) 항목, 없으면 우분투 기본값. */
export function loginNofile(state: SystemState): { soft: number; hard: number } {
  const limits = { soft: 1024, hard: 1_048_576 };
  const conf = findNode(state.fs, "/etc/security/limits.conf");
  if (conf?.kind === "file") {
    for (const line of conf.content.split("\n")) {
      const match = /^\s*(\S+)\s+(soft|hard|-)\s+nofile\s+(\d+|unlimited)\s*$/.exec(line);
      if (!match || (match[1] !== "*" && match[1] !== state.user)) continue;
      const value = match[3] === "unlimited" ? 1_048_576 : Number(match[3]);
      if (match[2] !== "hard") limits.soft = value;
      if (match[2] !== "soft") limits.hard = value;
    }
  }
  return state.shellLimits?.nofile ?? limits;
}

const ALL = (nofile: { soft: number }) => [
  "real-time non-blocking time  (microseconds, -R) unlimited", "core file size              (blocks, -c) 0",
  "data seg size               (kbytes, -d) unlimited", "scheduling priority                 (-e) 0",
  "file size                   (blocks, -f) unlimited", "pending signals                     (-i) 7645",
  "max locked memory           (kbytes, -l) 8192", "max memory size             (kbytes, -m) unlimited",
  `open files                          (-n) ${nofile.soft}`, "pipe size                (512 bytes, -p) 8",
  "POSIX message queues         (bytes, -q) 819200", "real-time priority                  (-r) 0",
  "stack size                  (kbytes, -s) 8192", "cpu time                   (seconds, -t) unlimited",
  "max user processes                  (-u) 7645", "virtual memory              (kbytes, -v) unlimited",
  "file locks                          (-x) unlimited",
].join("\n");

export const ulimit: Command = {
  name: "ulimit",
  summary: "이 셸의 자원 한도를 보거나 바꾼다 (-n 열린 파일 수, -S soft, -H hard, -a 전체)",
  usage: "ulimit [-SHa] [-n [값]]",
  run({ state, tokens, sudo }: CommandContext) {
    // 셸 내장 명령이라 sudo로는 찾을 수 없다(실제 sudo도 같은 오류를 낸다).
    if (sudo) return fail("sudo: ulimit: command not found");
    const flags = tokens.filter(t => t.startsWith("-")).join("").replace(/-/g, "");
    const values = tokens.filter(t => !t.startsWith("-"));
    const bad = [...flags].find(ch => !"SHan".includes(ch));
    if (bad) return fail(`bash: ulimit: -${bad}: invalid option\nulimit: usage: ulimit [-SHabcdefiklmnpqrstuvxPRT] [limit]`, 2);
    const nofile = loginNofile(state);
    if (flags.includes("a")) return ok(ALL(nofile));
    if (!flags.includes("n")) return ok("unlimited");
    const hardOnly = flags.includes("H") && !flags.includes("S");
    if (!values.length) return ok(String(hardOnly ? nofile.hard : nofile.soft));
    const value = values[0] === "unlimited" ? 1_048_576 : Number(values[0]);
    if (!Number.isInteger(value) || value < 0) return fail(`bash: ulimit: ${values[0]}: invalid number`);
    // 일반 사용자는 hard 한도보다 올릴 수 없다. -S/-H를 안 주면 bash는 둘 다 바꾼다.
    if (value > nofile.hard) return fail("bash: ulimit: open files: cannot modify limit: Operation not permitted");
    const next = { soft: flags.includes("H") && !flags.includes("S") ? nofile.soft : value, hard: flags.includes("S") && !flags.includes("H") ? nofile.hard : value };
    state.shellLimits = { ...state.shellLimits, nofile: next };
    return ok();
  },
};
