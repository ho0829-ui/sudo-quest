/**
 * grep -A/-B/-C 문맥 옵션. kubectl describe에서 "Last State" 아래 Reason·Exit Code를 함께 보는 흐름을 지원한다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { ubuntuWeb } from "../src/engine/state/hosts";
import { writeFile } from "../src/engine/state/fs";
import { kubernetesOom } from "../src/scenarios/kubernetes-oom";

function webWithFile() {
  const state = ubuntuWeb();
  writeFile(state.fs, "/tmp/app.log", { mtime: state.clock, content: ["a", "ERROR one", "b", "c", "d", "ERROR two", "e"].join("\n") });
  return state;
}

describe("grep 문맥 옵션", () => {
  it("-A N은 뒤 N줄을, -n과 함께면 문맥 줄에 번호-를 붙인다", () => {
    const result = runCommand(webWithFile(), "grep -n -A1 ERROR /tmp/app.log");
    expect(result.stdout).toBe(["2:ERROR one", "3-b", "--", "6:ERROR two", "7-e"].join("\n"));
  });

  it("-B·-C·붙여 쓴 값·긴 옵션을 모두 받고, 겹치는 묶음은 하나로 합친다", () => {
    const state = webWithFile();
    expect(runCommand(state, "grep -B 1 ERROR /tmp/app.log").stdout).toBe(["a", "ERROR one", "--", "d", "ERROR two"].join("\n"));
    expect(runCommand(state, "grep -C2 ERROR /tmp/app.log").stdout.split("\n")).toHaveLength(7);
    expect(runCommand(state, "grep --after-context=1 two /tmp/app.log").stdout).toBe("ERROR two\ne");
  });

  it("숫자가 아닌 값은 실제 grep처럼 종료 코드 2, -c와 함께면 개수만 낸다", () => {
    const state = webWithFile();
    const bad = runCommand(state, "grep -A x ERROR /tmp/app.log");
    expect(bad.exitCode).toBe(2);
    expect(bad.stderr).toBe("grep: x: invalid context length argument");
    expect(runCommand(state, "grep -c -A1 ERROR /tmp/app.log").stdout).toBe("2");
  });

  it("OOM 미션에서 describe | grep -A2 Last 로 종료 이유와 코드를 본다", () => {
    const result = runCommand(buildInitialState(kubernetesOom), "kubectl describe pod catalog-api-0000000002-00001 | grep -A2 Last",
      { available: kubernetesOom.commands });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Last State:\s+Terminated\n\s+Reason:\s+OOMKilled\n\s+Exit Code:\s+137/);
  });
});
