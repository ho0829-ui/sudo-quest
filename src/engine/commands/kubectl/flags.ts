/**
 * kubectl 하위 명령의 옵션 읽기. --name=value, --name value, -c value, -c=value를 모두 받는다.
 * 모르는 옵션은 실제 kubectl처럼 "unknown flag"로 거절한다.
 */
export interface FlagSpec {
  /** 값을 받는 옵션: 이름 → 정식 이름(별칭 포함, 예: c → container) */
  values?: Record<string, string>;
  /** 값 없이 켜는 옵션 */
  switches?: Record<string, string>;
}

export type Parsed = { ok: true; args: string[]; values: Record<string, string>; switches: Set<string> } | { ok: false; error: string };

export function parseFlags(tokens: string[], spec: FlagSpec): Parsed {
  const args: string[] = [];
  const values: Record<string, string> = {};
  const switches = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("-") || token === "-") { args.push(token); continue; }
    // KEY- (환경 변수 지우기) 같은 인자는 옵션이 아니다. 옵션은 -x 또는 --name 형태만.
    const match = /^(--?)([A-Za-z][\w-]*)(?:=(.*))?$/.exec(token);
    if (!match) return { ok: false, error: `error: unknown shorthand flag: '${token.slice(1, 2)}' in ${token}` };
    const [, dashes, name, inline] = match;
    if (spec.values && Object.hasOwn(spec.values, name)) {
      const value = inline ?? tokens[++i];
      if (value === undefined || value === "") return { ok: false, error: `error: flag needs an argument: ${dashes}${name}` };
      values[spec.values[name]] = value;
    } else if (spec.switches && Object.hasOwn(spec.switches, name) && inline === undefined) {
      switches.add(spec.switches[name]);
    } else {
      return { ok: false, error: dashes === "--" ? `error: unknown flag: --${name}` : `error: unknown shorthand flag: '${name[0]}' in ${token}` };
    }
  }
  return { ok: true, args, values, switches };
}
