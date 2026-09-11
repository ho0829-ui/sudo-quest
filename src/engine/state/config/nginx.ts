/**
 * nginx 설정 문법 검사.
 *
 * `nginx -t` 명령과 "서비스 시작 가능 여부" 판정이 이 함수 하나를 공유한다.
 * 그래야 nginx -t 가 통과하는데 재시작은 실패하는 모순이 생기지 않는다.
 *
 * 실제 nginx만큼 정밀하진 않다. 교육에 필요한 두 가지 실수만 잡는다.
 *   1) 지시어 끝의 세미콜론 누락
 *   2) 중괄호 짝 불일치
 */

export interface ConfigError {
  line: number;
  message: string;
}

export interface ConfigCheck {
  ok: boolean;
  error?: ConfigError;
}

/** 블록을 여는 지시어들. 이 뒤에는 세미콜론이 아니라 { 가 온다. */
const BLOCK_DIRECTIVES = ["http", "server", "location", "events", "upstream", "if", "map"];

export function validateNginxConf(content: string): ConfigCheck {
  const lines = content.split("\n");
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    // 주석과 빈 줄은 건너뛴다
    const line = lines[i].split("#")[0].trim();
    if (!line) continue;

    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
    if (depth < 0) {
      return { ok: false, error: { line: lineNumber, message: 'unexpected "}"' } };
    }

    // 중괄호로 끝나거나 시작하는 줄은 세미콜론이 필요 없다
    if (line.endsWith("{") || line.endsWith("}") || line.endsWith(";")) continue;

    // 여기까지 왔으면 세미콜론 없이 끝난 지시어다
    const directive = line.split(/\s+/)[0];
    if (BLOCK_DIRECTIVES.includes(directive)) {
      return {
        ok: false,
        error: { line: lineNumber, message: `directive "${directive}" has no opening "{"` },
      };
    }
    return {
      ok: false,
      error: {
        line: lineNumber,
        message: `directive "${directive}" is not terminated by ";"`,
      },
    };
  }

  if (depth !== 0) {
    return {
      ok: false,
      error: { line: lines.length, message: 'unexpected end of file, expecting "}"' },
    };
  }

  return { ok: true };
}

/** 설정 검증기 목록. 서비스의 configValidator 이름이 이 키를 가리킨다. */
export const configValidators = {
  nginx: validateNginxConf,
};

export type ConfigValidator = keyof typeof configValidators;
