/**
 * 라벨 셀렉터: get -l의 조건식(app=web, tier!=db, app, !legacy)과 set selector의 KEY=VALUE 목록.
 * 서비스가 파드를 고르는 규칙과 같은 일치 검사를 쓴다.
 */
type Requirement = { key: string; op: "=" | "!=" | "exists" | "!exists"; value?: string };

const KEY = /^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?\/)?[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/;
const VALUE = /^([A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?)?$/;

export function parseSelector(text: string): Requirement[] | string {
  const requirements: Requirement[] = [];
  for (const part of text.split(",")) {
    const match = /^(!?)([^=!]+)(?:(==|=|!=)(.*))?$/.exec(part.trim());
    if (!match || !KEY.test(match[2]) || (match[1] && match[3])) return `error: unable to parse requirement: found '${part}', expected: identifier`;
    const [, not, key, op, value] = match;
    if (op && !VALUE.test(value)) return `error: invalid label value: "${value}"`;
    requirements.push(op ? { key, op: op === "!=" ? "!=" : "=", value } : { key, op: not ? "!exists" : "exists" });
  }
  return requirements;
}

export function matches(labels: Record<string, string>, requirements: Requirement[]): boolean {
  return requirements.every(({ key, op, value }) => {
    const has = Object.hasOwn(labels, key);
    if (op === "exists") return has;
    if (op === "!exists") return !has;
    return op === "=" ? labels[key] === value : labels[key] !== value;
  });
}

/** set selector의 인자: app=web,tier=api 또는 공백으로 나눈 여러 개. 같음(=)만 허용한다. */
export function parseAssignments(args: string[]): Record<string, string> | string {
  const result: Record<string, string> = {};
  for (const pair of args.flatMap(arg => arg.split(","))) {
    const match = /^([^=]+)=(.*)$/.exec(pair);
    if (!match || !KEY.test(match[1]) || !VALUE.test(match[2])) return `error: invalid selector: "${pair}"`;
    result[match[1]] = match[2];
  }
  return Object.keys(result).length ? result : "error: selector is required";
}
