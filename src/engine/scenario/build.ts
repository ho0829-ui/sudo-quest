import { hostPresets } from "../state/hosts";
import type { SystemState } from "../state/types";
import type { Scenario } from "./types";

/** 정상 프리셋을 만들고, 시나리오의 장애를 순서대로 주입한다. */
export function buildInitialState(scenario: Scenario): SystemState {
  const state = hostPresets[scenario.host]();
  for (const fault of scenario.faults) fault(state);
  return state;
}

export type { Scenario } from "./types";
