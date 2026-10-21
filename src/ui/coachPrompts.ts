/**
 * 실습 중 코치를 쉽게 부르기 위한 순수 함수 모음.
 * 문장에는 플레이어가 이미 본 정보(직접 입력한 명령)만 넣는다. 정답·풀이·숨은 상태는 쓰지 않는다.
 */
import { supportsInvocation } from "../engine/commands";
import type { Session } from "../engine/session/session";

export type QuickPromptId = "summary" | "next" | "explain" | "hypothesis";

export interface QuickPrompt {
  id: QuickPromptId;
  label: string;
  question: string;
  /** true면 바로 보내지 않고 입력창에 채워 플레이어가 마저 쓰게 한다. */
  draft: boolean;
  disabled: boolean;
}

export const HYPOTHESIS_TEMPLATE = "내 가설: \n이 가설을 확인하거나 반박하려면 무엇을 실행해 보면 될까요?";

function lastTyped(session: Session): string | null {
  const line = [...session.lines].reverse().find(item => item.input.trim() !== "");
  return line ? line.input.trim().slice(0, 200) : null;
}

export function quickPrompts(session: Session): QuickPrompt[] {
  const last = lastTyped(session);
  return [
    { id: "summary", label: "지금까지 정리", draft: false, disabled: false,
      question: "지금까지 실행한 명령에서 확인된 사실과 아직 확인되지 않은 가설을 나눠 정리해 주세요." },
    { id: "next", label: "다음 점검", draft: false, disabled: false,
      question: "지금까지 본 것으로 다음에 무엇을 확인하면 좋을까요?" },
    { id: "explain", label: "마지막 출력 해석", draft: false, disabled: last === null,
      question: last ? `마지막으로 실행한 \`${last}\` 출력에서 무엇을 눈여겨봐야 하나요?` : "" },
    { id: "hypothesis", label: "내 가설 점검", draft: true, disabled: false, question: HYPOTHESIS_TEMPLATE },
  ];
}

// 가상 셸은 파이프·리다이렉션·명령 연결을 지원하지 않으므로, 그런 제안은 터미널로 옮기지 않는다.
const SHELL_OPERATORS = /[|;&<>]/;
const IN_BACKTICKS = /`([^`\n]+)`/g;

/**
 * 코치의 점검 제안에서 가상 터미널에 그대로 옮길 수 있는 명령을 고른다.
 * 실행은 하지 않는다. 플레이어가 터미널에서 직접 Enter를 눌러야 실행된다.
 */
export function runnableCommands(check: string, available: string[]): string[] {
  const found: string[] = [];
  for (const match of check.matchAll(IN_BACKTICKS)) {
    const command = match[1].trim();
    if (!command || SHELL_OPERATORS.test(command)) continue;
    // aws처럼 하위 명령이 있으면 지원하는 하위 명령인지까지 본다(예: aws cloudwatch는 제외).
    if (supportsInvocation(command, available) && !found.includes(command)) found.push(command);
  }
  return found;
}

export interface CoachNudge {
  message: string;
  promptId: QuickPromptId;
}

/**
 * 코치를 불러 볼 만한 순간을 알려 준다. 마지막 질문 이후의 변화만 본다.
 * 오답 보기 내용은 코치에 보내지 않으므로, 여기서도 "오답이 있었다"는 사실만 쓴다.
 */
export function coachNudge(wrongSinceAsk: number, commandsSinceAsk: number): CoachNudge | null {
  if (wrongSinceAsk > 0) {
    return { promptId: "summary",
      message: "원인 제출이 빗나갔어요. 확인된 사실과 가설을 다시 나눠 보면 다음 방향이 보일 수 있어요." };
  }
  if (commandsSinceAsk >= 6) {
    return { promptId: "summary", message: "명령을 여러 번 실행했어요. 지금까지 모은 단서를 한 번 정리해 볼까요?" };
  }
  return null;
}
