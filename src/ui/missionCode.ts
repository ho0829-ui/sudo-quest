/**
 * 실습 번호 ↔ 시나리오. 튜토리얼 연습 실습은 목록 밖이라 0번(#/tutorial)이고, 화면에는 "TUTORIAL"로 쓴다.
 * 시나리오 ID는 원인을 드러낼 수 있어(예: linux-disk-full) 화면·주소에는 번호만 쓴다.
 */
import type { Scenario } from "../engine/scenario/types";
import { scenarios } from "../scenarios";
import { isTutorial, tutorialScenario } from "../scenarios/tutorial-first-shift";
import { TUTORIAL_NO } from "./route";

export function missionNumber(scenario: Scenario): number {
  return isTutorial(scenario) ? TUTORIAL_NO : scenarios.indexOf(scenario) + 1;
}

export function scenarioByNumber(no: number): Scenario | undefined {
  return no === TUTORIAL_NO ? tutorialScenario : scenarios[no - 1];
}

/** "05" 또는 "TUTORIAL". 브리핑·HUD 머리표에 쓴다. */
export function missionCode(scenario: Scenario): string {
  return isTutorial(scenario) ? "TUTORIAL" : String(missionNumber(scenario)).padStart(2, "0");
}
