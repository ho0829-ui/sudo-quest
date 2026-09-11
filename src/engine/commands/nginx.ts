/**
 * nginx 명령어.
 *
 * `nginx -t` 는 서비스 시작 규칙과 똑같은 검증 함수를 쓴다. (state/config/nginx.ts)
 * 그래서 "nginx -t는 통과하는데 재시작은 실패" 같은 모순이 생기지 않는다.
 */
import { hasFlag } from "../parser/parse";
import { validateNginxConf } from "../state/config/nginx";
import { findNode } from "../state/fs";
import { fail, ok, type Command, type CommandContext } from "./types";

const CONF_PATH = "/etc/nginx/nginx.conf";

export const nginx: Command = {
  name: "nginx",
  summary: "nginx 설정을 검사한다 (-t)",
  usage: "nginx -t",
  run({ state, tokens }: CommandContext) {
    if (!hasFlag(tokens, "t")) {
      return fail(`nginx: 이 시뮬레이터는 설정 검사(-t)만 지원합니다\n사용법: ${nginx.usage}`, 1);
    }

    const node = findNode(state.fs, CONF_PATH);
    if (!node || node.kind !== "file") {
      return fail(
        `nginx: [emerg] open() "${CONF_PATH}" failed (2: No such file or directory)\n` +
          `nginx: configuration file ${CONF_PATH} test failed`,
        1,
      );
    }

    const check = validateNginxConf(node.content);
    if (!check.ok && check.error) {
      return fail(
        `nginx: [emerg] ${check.error.message} in ${CONF_PATH}:${check.error.line}\n` +
          `nginx: configuration file ${CONF_PATH} test failed`,
        1,
      );
    }

    return ok(
      `nginx: the configuration file ${CONF_PATH} syntax is ok\n` +
        `nginx: configuration file ${CONF_PATH} test is successful`,
    );
  },
};
