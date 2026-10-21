/**
 * 시나리오 문구(힌트·포스트모템·학습 목표·오답 해설)와 모범 풀이에 나오는 명령은
 * 그 실습에서 실제로 실행되어야 한다. 엔진이 "모르는 옵션/하위 명령"이라고 거절하면 실패한다.
 *
 * 장애 상태라서 나는 정상적인 오류(No such file, Connection refused, 만료된 인증서 등)는 허용한다.
 * 그건 플레이어가 봐야 할 단서이기 때문이다.
 */
import { describe, expect, it } from "vitest";
import { scenarios } from "../src/scenarios";
import { DEFAULT_COMMANDS } from "../src/engine/commands";
import { buildInitialState } from "../src/engine/scenario/build";
import { runCommand } from "../src/engine/run";

const BACKTICK = /`([^`\n]+)`/g;
// 엔진이 "지원하지 않음"을 뜻할 때 내는 실제형 메시지들.
const UNSUPPORTED = /Invalid choice|invalid option|unrecognized|Unknown operation|Invalid command|syntax error|^Usage:|Too few arguments|requires parameter/m;
// 문구 속 자리표시자(<값>, 파일, 찾을것)나 명령 조각은 실행 대상이 아니다.
const PLACEHOLDER = /<[^>]+>|찾을것|바꿀것|\s파일$/;

function nameOf(line: string): string {
  const words = line.trim().split(/\s+/);
  return words[0] === "sudo" ? words[1] ?? "" : words[0];
}

describe("시나리오에 나오는 명령은 그 실습에서 실행된다", () => {
  for (const scenario of scenarios) {
    it(scenario.id, () => {
      const available = scenario.commands ?? DEFAULT_COMMANDS;
      const texts = [
        ...scenario.hints, ...scenario.learningObjectives,
        ...Object.values(scenario.postmortem).filter((v): v is string => typeof v === "string"),
        ...scenario.rootCause.choices.map((c) => c.whyWrong ?? ""),
      ];
      const mentioned = texts.flatMap((t) => [...t.matchAll(BACKTICK)].map((m) => m[1].trim()));
      const lines = [...new Set([...scenario.solutionPath, ...mentioned])]
        .filter((line) => /^(sudo\s+)?[a-z]/.test(line) && line.includes(" ") && !PLACEHOLDER.test(line))
        .filter((line) => line.split("|").every((stage) => available.includes(nameOf(stage))));

      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        const result = runCommand(buildInitialState(scenario), line, { available });
        expect({ line, stderr: result.stderr }).not.toMatchObject({ stderr: expect.stringMatching(UNSUPPORTED) });
      }
    });
  }
});

describe("실무 점검 명령 보강", () => {
  const scenario = (id: string) => scenarios.find((s) => s.id === id)!;
  const run = (id: string, line: string) => {
    const s = scenario(id);
    return runCommand(buildInitialState(s), line, { available: s.commands ?? DEFAULT_COMMANDS });
  };

  it("nginx -T는 검사 결과와 설정 전문을, 모르는 옵션은 실제 문구로 거절한다", () => {
    const dump = run("linux-port-conflict", "nginx -T");
    expect(dump.stdout).toContain("# configuration file /etc/nginx/nginx.conf:");
    expect(run("linux-port-conflict", "nginx -x").stderr).toBe('nginx: invalid option: "x"');
  });

  it("nginx -s reload는 실행 중이 아니면 pid 파일 오류, 설정 오류면 [emerg]로 거부한다", () => {
    expect(run("web-nginx-config", "sudo nginx -s reload").stderr).toContain('open() "/run/nginx.pid" failed');
  });

  it("openssl s_client는 만료된 인증서를 검증 오류로 보여 준다", () => {
    const result = run("web-ssl-expired", "openssl s_client -connect shop.example.com:443");
    expect(result.stdout).toContain("Verify return code: 10 (certificate has expired)");
    expect(run("web-ssl-expired", "openssl foo").stderr).toBe(`Invalid command 'foo'; type "help" for a list.`);
  });

  it("mysql SHOW PROCESSLIST는 연결 수만큼 줄을 내고 wc로 셀 수 있다", () => {
    const count = run("db-max-connections", "mysql -e \"SHOW PROCESSLIST\" | wc -l").stdout;
    expect(Number(count)).toBe(101); // 머리글 1줄 + Threads_connected 100
    expect(run("db-max-connections", "mysql -e \"SELEC 1\"").stderr).toContain("ERROR 1064 (42000)");
  });
});
