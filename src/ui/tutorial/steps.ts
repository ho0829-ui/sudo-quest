/**
 * 튜토리얼 코치 마크의 단계. 화면 한 곳(target)을 밝히고 할 일을 말풍선으로 알려 준다.
 * done이 있는 단계는 플레이어가 실제로 해야 넘어가고(명령 입력·원인 제출·복구), 없는 단계는 "다음"을 눌러 넘긴다.
 * 어느 단계를 보여 줄지는 지금 화면(stage)·세션·"다음"을 누른 단계에서 계산한다(순수 함수라 테스트한다).
 */
import { isCleared, type Session } from "../../engine/session/session";

export type TutorialStage = "briefing" | "play" | "report";

export interface TutorialStep {
  id: string;
  stage: TutorialStage;
  /** 밝힐 화면 요소(CSS 선택자). 못 찾으면 말풍선만 띄운다. */
  target: string;
  title: string;
  body: string;
  /** 직접 칠 명령(말풍선에 코드로 보여 준다) */
  command?: string;
  /** 이걸 해야 넘어간다. 없으면 "다음" 버튼. */
  done?: (session: Session) => boolean;
}

const typed = (session: Session, prefix: string) =>
  session.commands.some(command => command.trim().replace(/^sudo\s+/, "").startsWith(prefix));

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: "ticket", stage: "briefing", target: ".briefing-ticket", title: "티켓에는 증상만 있어요",
    body: "고객이 겪은 증상만 적혀 있고 원인은 없어요. 원인은 서버에 들어가 직접 찾습니다. 다 읽었으면 아래 '조사 시작'을 눌러 주세요." },
  { id: "help", stage: "play", target: ".terminal-window", title: "명령은 여기에 쳐요",
    body: "가상 터미널이에요. 실제 컴퓨터에는 아무 영향이 없어요. 먼저 이 실습에서 쓸 수 있는 명령을 볼까요?",
    command: "help", done: s => typed(s, "help") },
  { id: "status", stage: "play", target: ".terminal-window", title: "웹 서버가 켜져 있나요?",
    body: "사이트가 안 열린다면, 요청을 받는 웹 서버(nginx)부터 봅니다. Active 줄을 눈여겨보세요.",
    command: "systemctl status nginx", done: s => typed(s, "systemctl status") },
  { id: "journal", stage: "play", target: ".terminal-window", title: "무슨 일이 있었는지 기록을 봐요",
    body: "inactive (dead)는 '꺼져 있음'이에요. 오류로 죽은 거라면 failed라고 나와요. 언제, 무엇이 껐는지 기록을 확인해요.",
    command: "journalctl -u nginx", done: s => typed(s, "journalctl") },
  { id: "help-tools", stage: "play", target: "aside.sidebar", title: "막히면 힌트와 AI 코치",
    body: "힌트는 세 단계로 하나씩 열려요(열 때마다 80·100·120점 감점). AI 코치는 정답 대신 다음에 볼 곳을 같이 생각해 줘요. 이번엔 그냥 넘어가도 돼요." },
  { id: "cause", stage: "play", target: ".cause-submit", title: "원인을 골라 제출해요",
    body: "'원인 제출하기'를 누르고 가장 그럴듯한 원인을 고르세요. 틀려도 괜찮아요. 왜 아닌지 알려 주고 감점은 80점이에요.",
    done: s => s.causeSolved },
  { id: "fix", stage: "play", target: ".terminal-window", title: "이제 고쳐요",
    body: "꺼진 서비스는 스스로 켜지지 않아요. root 권한이 필요하니 앞에 sudo를 붙입니다.",
    command: "sudo systemctl start nginx", done: s => isCleared(s) },
  { id: "postmortem", stage: "report", target: ".report-postmortem", title: "포스트모템 네 칸",
    body: "무슨 일이 있었나 · 왜 생겼나 · 어떻게 고쳤나 · 어떻게 예방하나. 실무에서도 장애가 끝나면 이렇게 기록해요. 이제 진짜 실습을 시작해 볼까요?" },
];

const ORDER: TutorialStage[] = ["briefing", "play", "report"];

/**
 * 지금 보여 줄 단계. 지난 화면의 단계는 끝난 것으로 보고, 이 화면에서 아직 안 끝난 첫 단계를 고른다.
 * 이 화면의 단계를 다 끝냈으면 null(말풍선을 숨긴다).
 */
export function currentStep(stage: TutorialStage, session: Session | null, acknowledged: ReadonlySet<string>): TutorialStep | null {
  for (const step of TUTORIAL_STEPS) {
    if (ORDER.indexOf(step.stage) < ORDER.indexOf(stage)) continue;
    if (step.stage !== stage) return null;
    const finished = step.done ? session !== null && step.done(session) : acknowledged.has(step.id);
    if (!finished) return step;
  }
  return null;
}
