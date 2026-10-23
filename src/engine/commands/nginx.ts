/**
 * nginx 명령어.
 *
 * `nginx -t` 는 서비스 시작 규칙과 똑같은 검증 함수를 쓴다. (state/config/nginx.ts)
 * 그래서 "nginx -t는 통과하는데 재시작은 실패" 같은 모순이 생기지 않는다.
 * `nginx -s reload` 는 systemctl reload와 같은 규칙(services.reloadService)을 쓴다.
 */
import { flagValue, hasFlag } from "../parser/parse";
import { validateNginxConf } from "../state/config/nginx";
import { nginxTlsProblem } from "../state/config/nginxSites";
import { findNode } from "../state/fs";
import { findService, reloadService, startService, stopService } from "../state/services";
import type { SystemState } from "../state/types";
import { fail, ok, type Command, type CommandContext, type CommandResult } from "./types";

const CONF_PATH = "/etc/nginx/nginx.conf";
const VERSION = "nginx version: nginx/1.24.0 (Ubuntu)";
const KNOWN = ["t", "T", "s", "v", "V", "h"];

/** 설정 검사. 실패하면 오류 결과, 통과하면 null과 설정 내용을 돌려준다. */
function testConfig(state: SystemState): { failure: CommandResult | null; content: string } {
  const node = findNode(state.fs, CONF_PATH);
  if (!node || node.kind !== "file") {
    return {
      failure: fail(`nginx: [emerg] open() "${CONF_PATH}" failed (2: No such file or directory)\nnginx: configuration file ${CONF_PATH} test failed`),
      content: "",
    };
  }
  const check = validateNginxConf(node.content);
  if (!check.ok && check.error) {
    return {
      failure: fail(`nginx: [emerg] ${check.error.message} in ${CONF_PATH}:${check.error.line}\nnginx: configuration file ${CONF_PATH} test failed`),
      content: node.content,
    };
  }
  // 서비스 시작과 같은 함수로 인증서·키도 검사한다.
  const tls = nginxTlsProblem(state, node.content);
  if (tls) return { failure: fail(`nginx: ${tls}\nnginx: configuration file ${CONF_PATH} test failed`), content: node.content };
  return { failure: null, content: node.content };
}

const PASSED = `nginx: the configuration file ${CONF_PATH} syntax is ok\nnginx: configuration file ${CONF_PATH} test is successful`;

/** -s 신호: 실행 중인 master 프로세스에 보낸다. 없으면 pid 파일이 없다는 실제 오류가 난다. */
function signal(state: SystemState, user: string, name: string): CommandResult {
  const service = findService(state, "nginx");
  const running = service?.state === "active" && service.mainPid !== undefined;
  if (!running) return fail(`nginx: [error] open() "/run/nginx.pid" failed (2: No such file or directory)`);
  if (user !== "root") return fail(`nginx: [alert] kill(${service!.mainPid}, 1) failed (1: Operation not permitted)`);
  if (name === "reload") {
    const outcome = reloadService(state, "nginx");
    // 새 설정이 잘못되면 master가 거부하고 기존 설정으로 계속 돈다. 오류만 남긴다.
    return outcome.ok ? ok() : fail(`nginx: [emerg] ${outcome.reason?.replace(/^\[emerg\] /, "") ?? "reload failed"}`);
  }
  stopService(state, "nginx");
  return ok();
}

export const nginx: Command = {
  name: "nginx",
  summary: "nginx 설정 검사·재적용 (-t 검사, -T 검사+설정 출력, -s reload|stop)",
  usage: "nginx [-t | -T | -s reload|stop | -v]",
  run({ state, tokens, user }: CommandContext) {
    const unknown = tokens.find((t) => t.startsWith("-") && !KNOWN.includes(t.slice(1)));
    if (unknown) return fail(`nginx: invalid option: "${unknown.slice(1)}"`);
    if (hasFlag(tokens, "v") || hasFlag(tokens, "V")) return { stdout: "", stderr: VERSION, exitCode: 0 };

    if (hasFlag(tokens, "s")) {
      const name = flagValue(tokens, "s");
      if (!name) return fail(`nginx: option "-s" requires parameter`);
      if (!["reload", "stop", "quit"].includes(name)) return fail(`nginx: invalid option: "-s ${name}"`);
      return signal(state, user, name);
    }

    if (hasFlag(tokens, "t") || hasFlag(tokens, "T")) {
      const { failure, content } = testConfig(state);
      if (failure) return failure;
      // -T는 검사 결과 뒤에 실제로 읽은 설정 파일 전체를 붙인다.
      return ok(hasFlag(tokens, "T") ? `${PASSED}\n# configuration file ${CONF_PATH}:\n${content.replace(/\n$/, "")}` : PASSED);
    }

    // 옵션 없이 실행하면 서버를 띄운다(보통은 systemctl을 쓴다). root가 아니면 로그·pid 파일을 열지 못한다.
    if (user !== "root") {
      return fail(`nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)\n` +
        `nginx: [emerg] open() "/run/nginx.pid" failed (13: Permission denied)`);
    }
    const outcome = startService(state, "nginx");
    return outcome.ok ? ok() : fail(`nginx: [emerg] ${outcome.reason?.replace(/^\[emerg\] /, "") ?? "start failed"}`);
  },
};
