/** 엔진의 공개 API. UI는 여기만 import 한다. */
export { runCommand, type RunResult } from "./run";
export { buildInitialState } from "./scenario/build";
export { DEFAULT_COMMANDS, getCommand } from "./commands";
export type { Scenario, Category, Difficulty } from "./scenario/types";
export type { SystemState } from "./state/types";
