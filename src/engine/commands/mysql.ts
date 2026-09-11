/**
 * mysql 클라이언트.
 *
 * DB 엔진을 흉내 내지 않는다. 트러블슈팅에 실제로 쓰는 세 가지만 지원한다.
 *   SHOW VARIABLES LIKE '...'   설정값 조회
 *   SHOW STATUS LIKE '...'      현재 상태 조회
 *   SET GLOBAL 이름 = 값         설정값 변경
 */
import { flagValue, hasFlag } from "../parser/parse";
import { table } from "../state/format";
import type { Database } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

/** mysql 클라이언트의 기본 출력(표 형식)을 흉내 낸다. */
function renderTable(rows: [string, string][]): string {
  if (rows.length === 0) return "Empty set (0.00 sec)";
  const body = table([["Variable_name", "Value"], ...rows], ["left", "left"]);
  const lines = body.split("\n");
  const width = Math.max(...lines.map((l) => l.length));
  const border = `+${"-".repeat(width + 2)}+`;
  return [
    border,
    ...lines.map((line) => `| ${line.padEnd(width)} |`),
    border,
    `${rows.length} row${rows.length > 1 ? "s" : ""} in set (0.00 sec)`,
  ].join("\n");
}

/** LIKE 패턴(%)을 정규식으로 바꾼다. */
function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.split("%").join(".*")}$`, "i");
}

function runQuery(db: Database, sql: string): { output: string; error?: string } {
  const query = sql.trim().replace(/;$/, "");

  const show = /^SHOW\s+(GLOBAL\s+)?(VARIABLES|STATUS)(\s+LIKE\s+'([^']*)')?$/i.exec(query);
  if (show) {
    const source = show[2].toUpperCase() === "VARIABLES" ? db.variables : db.status;
    const pattern = show[4] ? likeToRegex(show[4]) : null;
    const rows = Object.entries(source)
      .filter(([name]) => !pattern || pattern.test(name))
      .sort(([a], [b]) => a.localeCompare(b)) as [string, string][];
    return { output: renderTable(rows) };
  }

  const set = /^SET\s+GLOBAL\s+([\w_]+)\s*=\s*'?([^';]+)'?$/i.exec(query);
  if (set) {
    const [, name, value] = set;
    if (!(name in db.variables)) {
      return { output: "", error: `ERROR 1193 (HY000) at line 1: Unknown system variable '${name}'` };
    }
    db.variables[name] = value.trim();
    return { output: "" };
  }

  return {
    output: "",
    error:
      "ERROR: 이 시뮬레이터는 SHOW VARIABLES / SHOW STATUS / SET GLOBAL 만 지원합니다.\n" +
      "예: mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"",
  };
}

export const mysql: Command = {
  name: "mysql",
  summary: "DB 설정과 상태를 조회하고 바꾼다 (-e \"쿼리\")",
  usage: "mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"",
  run({ state, tokens }: CommandContext) {
    if (!state.database) {
      return fail("ERROR 2002 (HY000): Can't connect to local MySQL server through socket", 1);
    }

    const sql = flagValue(tokens, "e", "execute");
    if (!sql) {
      if (hasFlag(tokens, "e", "execute")) return fail("mysql: option '-e' requires an argument", 1);
      return fail(
        `mysql: 이 시뮬레이터는 대화형 셸을 지원하지 않습니다. -e 로 쿼리를 넘겨주세요\n사용법: ${mysql.usage}`,
        1,
      );
    }

    const result = runQuery(state.database, sql);
    if (result.error) return fail(result.error, 1);
    return ok(result.output);
  },
};
