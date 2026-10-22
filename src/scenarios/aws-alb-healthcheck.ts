import { withCommands } from "../engine/commands/names";
import { targetGroupIsHealthy } from "../engine/judge";
import { logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

const TG_ARN =
  "arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/shop-tg/73e2d6bc24d8a067";

/**
 * 헬스체크 경로를 인스턴스가 서빙하지 않는 경로로 바꾼다.
 * 타깃이 unhealthy가 되는 판단은 엔진이 servedPaths를 보고 직접 한다.
 * 모든 타깃이 unhealthy여도 ALB는 fail-open하므로, 이 장애의 증상은 503이 아니라 "알람만 울림"이다.
 */
const breakHealthCheckPath: Fault = (state) => {
  const group = state.aws?.targetGroups?.find((g) => g.arn === TG_ARN);
  if (!group) throw new Error("타깃 그룹을 찾을 수 없습니다");
  group.healthCheckPath = "/healthz"; // 실제 앱은 /health 로 서빙한다
};

export const awsAlbHealthcheck: Scenario = {
  id: "aws-alb-healthcheck",
  title: "헬스 알람이 울리는데 사이트는 열려요",
  category: "aws",
  difficulty: 2,

  // AWS 공식 동작: 모든 활성 AZ의 모든 타깃이 헬스체크에 실패하면 ALB는 fail-open하여
  // 상태와 무관하게 모든 타깃으로 요청을 보낸다. 그래서 이 장애에서 사용자는 503을 보지 않는다.
  // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
  ticket: [
    "모니터링 알람이 15분째 계속 울리고 있습니다: 'shop-alb HealthyHostCount = 0'.",
    "그런데 쇼핑몰은 지금도 정상적으로 열리고 주문도 들어오고 있습니다.",
    "어제 인프라 팀에서 설정 표준화 작업이 있었다고 합니다.",
    "알람이 잘못 울리는 거라면 꺼도 될까요? 확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "모든 타깃이 unhealthy이면 ALB가 fail-open하여 모든 타깃으로 트래픽을 보낸다는 것을 안다 (사이트가 열려도 헬스체크는 고장일 수 있다)",
    "타깃 헬스 상태와 그 이유(Reason)를 조회해 알람이 오탐인지 실제 문제인지 가린다",
    "헬스체크 경로가 애플리케이션이 실제로 서빙하는 경로와 일치해야 한다는 것을 안다",
  ],

  host: "aws-admin",
  commands: withCommands("aws", "curl"),

  faults: [
    breakHealthCheckPath,
    logLine("monitoring-agent", "ALB shop-alb: HealthyHostCount = 0", {
      priority: "err",
      offsetMs: -900_000,
    }),
    logLine("monitoring-agent", "ALB shop-alb: UnHealthyHostCount = 1", {
      priority: "err",
      offsetMs: -900_000,
    }),
    // 원인과 무관해 보이는 정상 지표. 사용자 요청은 타깃이 계속 처리하고 있다.
    logLine("monitoring-agent", "ALB shop-alb: HTTPCode_Target_2XX_Count = 1842 in last 5 minutes", {
      priority: "info",
      offsetMs: -600_000,
    }),
  ],

  rootCause: {
    answerId: "healthcheck-path",
    choices: [
      {
        id: "healthcheck-path",
        label: "타깃 그룹의 헬스체크 경로가 애플리케이션이 서빙하지 않는 경로(/healthz)로 설정되어 모든 타깃이 unhealthy가 됐다 (ALB는 fail-open으로 트래픽을 계속 보내 사이트는 열린다)",
      },
      {
        id: "false-alarm",
        label: "모니터링 알람 설정이 잘못되어 생긴 오탐이다. 로드밸런서와 타깃에는 문제가 없다",
        whyWrong:
          "describe-target-health를 보면 ALB 자체가 타깃을 unhealthy(Target.ResponseCodeMismatch)로 판단하고 있습니다. 사이트가 열리는 건 모든 타깃이 unhealthy일 때 ALB가 fail-open하기 때문입니다. 이 상태에서는 실제로 죽은 타깃도 트래픽에서 빠지지 않으므로 알람을 끄면 안 됩니다.",
      },
      {
        id: "app-down",
        label: "EC2 인스턴스의 애플리케이션이 죽어서 응답하지 못한다",
        whyWrong:
          "사이트는 정상적으로 열리고 Target 2XX 응답도 계속 나오고 있습니다. describe-target-health의 Reason도 응답 코드 불일치를 가리킵니다 — 서버는 응답했지만 404를 돌려줬다는 뜻입니다.",
      },
      {
        id: "sg-blocked",
        label: "보안그룹이 ALB에서 인스턴스로 가는 트래픽을 막고 있다",
        whyWrong:
          "보안그룹에 막혔다면 헬스체크가 타임아웃되고 Reason이 Target.Timeout으로 나옵니다. 여기서는 응답을 받긴 받았습니다. 또 막혔다면 사용자 요청도 타깃에 닿지 못했을 것입니다.",
      },
      {
        id: "no-targets",
        label: "타깃 그룹에 등록된 인스턴스가 하나도 없다",
        whyWrong:
          "describe-target-health를 보면 타깃은 등록되어 있습니다. 등록된 타깃이 없거나 모두 unused였다면 ALB는 503을 돌려줘서 사이트가 열리지 않았을 것입니다.",
      },
    ],
  },

  hints: [
    "알람은 '정상 타깃이 0개'라고 하고, 사이트는 열립니다. 둘 중 무엇이 틀렸는지 단정하기 전에, 로드밸런서가 각 타깃을 어떻게 판단하고 있는지 직접 볼 수 있지 않을까요?",
    "`aws elbv2 describe-target-health --target-group-arn <값>` 으로 타깃 상태와 그 이유를 볼 수 있습니다. 타깃 그룹 ARN은 `aws elbv2 describe-target-groups` 로 찾으세요.",
    "타깃은 unhealthy이고 이유는 Target.ResponseCodeMismatch(404)입니다. 모든 타깃이 unhealthy이면 ALB는 fail-open으로 트래픽을 계속 보내서 사이트가 열렸던 것입니다. 헬스체크 경로가 /healthz 인데 앱은 /health 를 서빙합니다. `aws elbv2 modify-target-group --target-group-arn <값> --health-check-path /health` 로 고치세요.",
  ],

  resolution: targetGroupIsHealthy(TG_ARN),

  solutionPath: [
    "aws elbv2 describe-load-balancers",
    "aws elbv2 describe-target-groups",
    `aws elbv2 describe-target-health --target-group-arn ${TG_ARN}`,
    `aws elbv2 modify-target-group --target-group-arn ${TG_ARN} --health-check-path /health`,
    `aws elbv2 describe-target-health --target-group-arn ${TG_ARN}`,
  ],

  postmortem: {
    whatHappened:
      "타깃 그룹의 헬스체크 경로가 /health 에서 /healthz 로 변경되었습니다. 애플리케이션은 /healthz 를 서빙하지 않아 404를 돌려줬고, ALB는 응답 코드가 기대값(200)과 다르다는 이유로 모든 타깃을 unhealthy로 표시했습니다. HealthyHostCount가 0이 되어 알람이 울렸습니다. 하지만 모든 활성 가용 영역의 모든 타깃이 헬스체크에 실패하면 ALB는 fail-open하여 상태와 무관하게 모든 타깃으로 요청을 보냅니다. 애플리케이션은 정상이었으므로 사용자는 장애를 느끼지 못했고, 알람만이 유일한 신호였습니다.",
    whyItHappened:
      "헬스체크 경로를 표준화하면서 애플리케이션이 실제로 어떤 경로를 서빙하는지 확인하지 않았습니다. 설정을 바꾼 뒤 타깃 헬스 상태를 확인하지 않았고, 사이트가 열리니 알람을 오탐으로 여기기 쉬운 상황이었습니다.",
    howToFix:
      "헬스체크 경로를 애플리케이션이 실제로 서빙하는 /health 로 되돌립니다. 변경 후에는 타깃이 healthy로 돌아오는지 확인해야 합니다 — 설정 변경이 반영되기까지 헬스체크 간격만큼 시간이 걸립니다.",
    howToPrevent: [
      "1) 헬스체크 설정을 바꾼 뒤 반드시 타깃 헬스 상태를 확인합니다. '명령이 성공했다'와 '서비스가 정상이다'는 다릅니다.",
      "2) HealthyHostCount 알람은 사이트가 열려도 무시하지 않습니다. fail-open 중에는 실제로 죽은 타깃도 트래픽에서 빠지지 않아, 다음 장애가 곧바로 사용자 오류로 이어집니다.",
      "3) 인프라를 코드로 관리해 헬스체크 경로가 애플리케이션 코드와 함께 리뷰되게 합니다.",
      "4) 변경을 한 번에 전체가 아니라 단계적으로 적용합니다.",
    ].join("\n"),
    realWorldNote:
      "AWS 문서 기준으로, 타깃이 모두 unhealthy일 때는 fail-open이고 503의 대표 원인은 '등록된 타깃이 없거나 모두 unused(미등록·리스너 규칙에서 미사용·비활성 AZ·중지/종료)'인 경우입니다. 502는 타깃과의 연결·응답 문제, 504는 연결·응답 시간 초과입니다. CloudWatch의 HTTPCode_ELB_5XX(로드밸런서가 만든 에러)와 HTTPCode_Target_5XX(애플리케이션이 만든 에러)를 구분하는 것도 중요합니다. 참고: Target group health checks, Troubleshoot your Application Load Balancers (docs.aws.amazon.com).",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "Application Load Balancer — Target group health checks", url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html" },
    { kind: "official-doc", title: "Application Load Balancer — 문제 해결", url: "https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-troubleshooting.html" },
  ],
};
