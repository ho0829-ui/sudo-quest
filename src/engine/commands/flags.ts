/**
 * kubectl·docker 하위 명령의 옵션 읽기. --name=value, --name value, -c value, -c=value를 모두 받는다.
 * 모르는 옵션은 실제 CLI처럼 "unknown flag"로 거절한다(문장 앞뒤는 부르는 쪽이 CLI에 맞게 붙인다).
 */
export interface FlagSpec {
  /** 값을 받는 옵션: 이름 → 정식 이름(별칭 포함, 예: c → container) */
  values?: Record<string, string>;
  /** 값 없이 켜는 옵션 */
  switches?: Record<string, string>;
  /** 여러 번 줄 수 있는 값 옵션(docker run -p, -e). 들어온 순서대로 모은다. */
  lists?: Record<string, string>;
  /** 첫 인자부터는 옵션으로 읽지 않는다. docker run IMAGE 뒤의 명령·옵션은 컨테이너의 것이다. */
  stopAtFirstArg?: boolean;
}

export type Parsed =
  | { ok: true; args: string[]; values: Record<string, string>; switches: Set<string>; lists: Record<string, string[]> }
  | { ok: false; error: string };

export function parseFlags(tokens: string[], spec: FlagSpec): Parsed {
  const args: string[] = [];
  const values: Record<string, string> = {};
  const switches = new Set<string>();
  const lists: Record<string, string[]> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("-") || token === "-") {
      if (spec.stopAtFirstArg) { args.push(...tokens.slice(i)); break; }
      args.push(token);
      continue;
    }
    // KEY- (환경 변수 지우기) 같은 인자는 옵션이 아니다. 옵션은 -x 또는 --name 형태만.
    const match = /^(--?)([A-Za-z][\w-]*)(?:=(.*))?$/.exec(token);
    if (!match) return { ok: false, error: `error: unknown shorthand flag: '${token.slice(1, 2)}' in ${token}` };
    const [, dashes, name, inline] = match;
    if (spec.values && Object.hasOwn(spec.values, name)) {
      const value = inline ?? tokens[++i];
      if (value === undefined || value === "") return { ok: false, error: `error: flag needs an argument: ${dashes}${name}` };
      values[spec.values[name]] = value;
    } else if (spec.lists && Object.hasOwn(spec.lists, name)) {
      const value = inline ?? tokens[++i];
      if (value === undefined || value === "") return { ok: false, error: `error: flag needs an argument: ${dashes}${name}` };
      (lists[spec.lists[name]] ??= []).push(value);
    } else if (spec.switches && Object.hasOwn(spec.switches, name) && inline === undefined) {
      switches.add(spec.switches[name]);
    } else {
      return { ok: false, error: dashes === "--" ? `error: unknown flag: --${name}` : `error: unknown shorthand flag: '${name[0]}' in ${token}` };
    }
  }
  return { ok: true, args, values, switches, lists };
}
