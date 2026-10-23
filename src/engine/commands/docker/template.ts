/**
 * docker --format / inspect -f의 Go 템플릿 중 자주 쓰는 모양만 지원한다.
 * {{.State.Status}}, {{.Config.Env}}, {{json .Config.Env}}, 그리고 \t·고정 글자. range·if 같은 문법은 거절한다.
 */
type Value = unknown;

/** Go fmt가 값을 찍는 모양: 배열은 [a b], 맵은 map[k:v], 없는 값은 <no value> */
function goFormat(value: Value): string {
  if (value === undefined || value === null) return "<no value>";
  if (Array.isArray(value)) return `[${value.map(goFormat).join(" ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, Value>).sort(([a], [b]) => a.localeCompare(b));
    return `map[${entries.map(([k, v]) => `${k}:${goFormat(v)}`).join(" ")}]`;
  }
  return String(value);
}

function lookup(data: Value, path: string): Value {
  return path.split(".").filter(Boolean).reduce<Value>((node, key) =>
    node && typeof node === "object" ? (node as Record<string, Value>)[key] : undefined, data);
}

export function renderTemplate(template: string, data: Value): { ok: true; text: string } | { ok: false; error: string } {
  let failed: string | null = null;
  const text = template.replace(/\\t/g, "\t").replace(/\\n/g, "\n").replace(/{{\s*(.*?)\s*}}/g, (_, expr: string) => {
    const plain = /^(\.[\w.]*)$/.exec(expr);
    if (plain) return goFormat(lookup(data, plain[1]));
    const json = /^json\s+(\.[\w.]*)$/.exec(expr);
    if (json) return JSON.stringify(lookup(data, json[1]) ?? null);
    failed ??= `template parsing error: template: :1: unexpected "${expr.split(/\s+/)[0]}" in command`;
    return "";
  });
  return failed ? { ok: false, error: failed } : { ok: true, text };
}
