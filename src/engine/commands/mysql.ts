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
    if (!Object.hasOwn(db.variables, name)) {
      return { output: "", error: `ERROR 1193 (HY000) at line 1: Unknown system variable '${name}'` };
    }
    const text = value.trim();
    // 현재 모델의 설정은 모두 정수다. Infinity 같은 문자열로 복구 판정을 우회하지 못하게 한다.
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < 1 || (name === "max_connections" && Number(text) > 100_000)) {
      return { output: "", error: `ERROR 1231 (42000) at line 1: Variable '${name}' can't be set to the value of '${text}'` };
    }
    db.variables[name] = text;
    return { output: "" };
  }

  if (/^SHOW\s+(FULL\s+)?PROCESSLIST$/i.test(query)) return { output: processList(db) };
  if (/^SHOW\s+DATABASES$/i.test(query)) {
    return { output: renderList("Database", ["information_schema", "mysql", "performance_schema", "shop", "sys"]) };
  }

  // 모델에 없는 문장은 실제 서버의 문법 오류 형식으로 거절한다.
  return {
    output: "",
    error: `ERROR 1064 (42000) at line 1: You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${query.slice(0, 40)}' at line 1`,
  };
}

/**
 * SHOW PROCESSLIST: 연결 수(Threads_connected)만큼 줄을 만든다. 상태에서 계산하므로
 * 연결이 상한에 붙어 있으면 목록도 그만큼 길다(`| wc -l` 로 셀 수 있다).
 */
function processList(db: Database): string {
  const count = Number(db.status.Threads_connected ?? 1);
  const rows = ["Id\tUser\tHost\tdb\tCommand\tTime\tState\tInfo"];
  for (let i = 0; i < count; i++) {
    const app = (i % 6) + 1;
    rows.push(`${1000 + i}\tshop_app\tapp-0${app}:${40000 + i}\tshop\tSleep\t${(i * 7) % 60}\t\tNULL`);
  }
  return rows.join("\n");
}

function renderList(header: string, values: string[]): string {
  const width = Math.max(header.length, ...values.map((v) => v.length));
  const line = `+${"-".repeat(width + 2)}+`;
  return [line, `| ${header.padEnd(width)} |`, line, ...values.map((v) => `| ${v.padEnd(width)} |`), line].join("\n");
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
      // 대화형 입력을 기다릴 수 없으므로, 입력이 끝난(EOF) 실제 클라이언트처럼 접속했다가 바로 나간다.
      return ok(`Welcome to the MySQL monitor.  Commands end with ; or \\g.\nServer version: ${state.database.version}\n\nmysql> Bye`);
    }

    const result = runQuery(state.database, sql);
    if (result.error) return fail(result.error, 1);
    return ok(result.output);
  },
};
