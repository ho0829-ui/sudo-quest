/**
 * 입력 문자열을 명령어로 파싱한다.
 *
 * 지원: 따옴표, sudo 접두사, > / >> 리다이렉션, 파이프(|)
 * 미지원: 변수, 백틱, &&·;·|| — 실제 셸을 흉내 내는 비용이 너무 커서 뺐다.
 * 파이프는 로그를 거르는 실무 습관(`journalctl ... | grep error`)이 너무 흔해서 지원한다.
 */

export interface ParsedCommand {
  raw: string;
  /** sudo를 붙였는가 (붙이면 그 명령만 root로 실행된다) */
  sudo: boolean;
  /** 명령어 이름. 빈 입력이거나 리다이렉션만 있으면 "" */
  name: string;
  /** 명령어 이름을 뺀 나머지 토큰 (플래그 + 인자) */
  tokens: string[];
  redirect?: { path: string; append: boolean };
}

/** 따옴표를 고려해서 단어 단위로 쪼갠다. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let hasContent = false; // 빈 따옴표("")도 하나의 토큰으로 인정하기 위한 표시

  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasContent = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (current || hasContent) tokens.push(current);
      current = "";
      hasContent = false;
      continue;
    }
    current += ch;
  }
  if (current || hasContent) tokens.push(current);
  return tokens;
}

/**
 * 파이프(|)로 명령을 나눈다. 따옴표 안의 | 는 글자로 둔다(grep 'a|b').
 * 빈 단계가 있으면(맨 앞·맨 뒤·연속 |) 실제 bash처럼 문법 오류로 null을 돌려준다.
 */
export function splitPipeline(input: string): string[] | null {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    if (ch === "|") {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  if (parts.length > 1 && parts.some((part) => part.trim() === "")) return null;
  return parts.map((part) => part.trim());
}

export function parse(input: string): ParsedCommand {
  const raw = input.trim();
  let tokens = tokenize(raw);

  // 리다이렉션을 먼저 떼어낸다. "cmd > path", "cmd >path" 둘 다 지원.
  let redirect: ParsedCommand["redirect"];
  const redirectIndex = tokens.findIndex((t) => t.startsWith(">"));
  if (redirectIndex !== -1) {
    const token = tokens[redirectIndex];
    const append = token.startsWith(">>");
    const inline = token.slice(append ? 2 : 1);
    const path = inline || tokens[redirectIndex + 1] || "";
    redirect = { path, append };
    tokens = tokens.slice(0, redirectIndex);
  }

  let sudo = false;
  if (tokens[0] === "sudo") {
    sudo = true;
    tokens = tokens.slice(1);
  }

  return { raw, sudo, name: tokens[0] ?? "", tokens: tokens.slice(1), redirect };
}

// ---------- 플래그/인자 읽기 헬퍼 ----------
// 명령어마다 필요한 플래그가 달라서, 파서가 미리 해석하지 않고
// 각 명령어가 아래 헬퍼로 직접 꺼내 쓴다.

const isFlag = (token: string) => token.startsWith("-") && token !== "-";

/**
 * 플래그가 있는지 본다. 짧은 플래그는 뭉쳐 쓸 수 있다. (-sh = -s -h)
 * hasFlag(tokens, "h", "human-readable")
 */
export function hasFlag(tokens: string[], short: string, long?: string): boolean {
  return tokens.some((t) => {
    if (!isFlag(t)) return false;
    if (t.startsWith("--")) return long !== undefined && t.slice(2).split("=")[0] === long;
    // short가 비어 있으면(긴 이름만 있는 옵션) 짧은 플래그와는 절대 매칭되면 안 된다
    return short !== "" && t.slice(1).includes(short);
  });
}

/**
 * 값을 받는 플래그를 읽는다. "-n 20", "-n20", "--lines=20" 모두 지원.
 * 값이 없으면 undefined.
 */
export function flagValue(tokens: string[], short: string, long?: string): string | undefined {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isFlag(t)) continue;
    if (t.startsWith("--")) {
      const [key, value] = [t.slice(2).split("=")[0], t.slice(2).split("=")[1]];
      if (long !== undefined && key === long) return value ?? tokens[i + 1];
      continue;
    }
    if (short === "") continue; // 긴 이름만 있는 옵션은 짧은 플래그로 찾지 않는다
    const idx = t.indexOf(short, 1);
    if (idx === -1) continue;
    const rest = t.slice(idx + 1);
    return rest || tokens[i + 1];
  }
  return undefined;
}

/**
 * 플래그가 아닌 인자들만 골라낸다.
 * valueFlags에 적은 플래그의 값은 인자가 아니므로 건너뛴다. (예: tail -n 20 app.log → ["app.log"])
 */
export function positionals(tokens: string[], valueFlags: string[] = []): string[] {
  const args: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!isFlag(t)) {
      args.push(t);
      continue;
    }
    // "-n 20" 처럼 다음 토큰이 값인 경우를 건너뛴다
    const takesValue = valueFlags.some((f) =>
      f.length === 1 ? t.startsWith("-") && !t.startsWith("--") && t.endsWith(f) : t === `--${f}`,
    );
    if (takesValue) i++;
  }
  return args;
}
