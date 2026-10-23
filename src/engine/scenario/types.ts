/**
 * 시나리오가 지켜야 할 계약.
 *
 * 시나리오는 "코드"가 아니라 "데이터"다.
 * 새 시나리오를 추가할 때 엔진을 고칠 일이 없어야 한다. (CLAUDE.md 4-3)
 */
import type { Check } from "../judge";
import type { Fault } from "../state/faults";
import type { HostPreset } from "../state/hosts";

import type { Category } from "./categories";

export type { Category } from "./categories";
export type Difficulty = 1 | 2 | 3;

/**
 * 이 장애가 실제로 일어나는 일이라는 근거.
 * - official-doc: 공식 문서가 이 증상·원인을 설명하거나 문제 해결 절차로 다룬다
 * - postmortem: 공개된 장애 회고에 같은 원인이 나온다
 * - survey: 업계 조사가 이 유형을 주요 원인으로 꼽는다
 */
export type EvidenceKind = "official-doc" | "postmortem" | "survey";

export interface Evidence {
  kind: EvidenceKind;
  title: string;
  url: string;
}

export interface RootCauseChoice {
  id: string;
  label: string;
  /** 오답을 골랐을 때 보여줄 설명. "왜 이건 원인이 아닌가"가 가장 배울 게 많다. */
  whyWrong?: string;
}

export interface Postmortem {
  whatHappened: string;
  whyItHappened: string;
  howToFix: string;
  /** 재발 방지책 (모니터링, 알림, 자동화). 이 게임에서 제일 중요한 칸이다. */
  howToPrevent: string;
  realWorldNote?: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: Category;
  difficulty: Difficulty;
  /** 고객이나 동료가 보낸 장애 신고. 증상만 적는다. 원인을 절대 노출하지 않는다. */
  ticket: string;
  learningObjectives: string[];

  /** 정상 서버 프리셋 */
  host: HostPreset;
  /** 이 프리셋을 어떻게 망가뜨릴지 */
  faults: Fault[];

  rootCause: {
    choices: RootCauseChoice[];
    answerId: string;
  };

  /** 이 시나리오에서 쓸 수 있는 명령어. 생략하면 기본 묶음 */
  commands?: string[];

  /** 3단계 힌트: 방향 질문 → 볼 곳 제시 → 거의 정답 */
  hints: [string, string, string];

  /** 복구 판정 */
  resolution: Check;

  /** 모범 풀이. 테스트가 이 순서대로 실행해서 resolution이 true가 되는지 검증한다. */
  solutionPath: string[];

  postmortem: Postmortem;

  /**
   * 실제성 근거. 1개 이상, 그중 하나는 공식 문서나 공개 회고여야 한다(테스트로 검사).
   * 원인을 드러내므로 브리핑·티켓·코치 요청에는 쓰지 않고, 클리어 리포트에서만 보여 준다.
   */
  evidence: Evidence[];
}
