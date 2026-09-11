import { withCommands } from "../engine/commands";
import { targetGroupIsHealthy } from "../engine/judge";
import { logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

const TG_ARN =
  "arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/shop-tg/73e2d6bc24d8a067";

/**
 * 헬스체크 경로를 인스턴스가 서빙하지 않는 경로로 바꾼다.
 * 타깃이 unhealthy가 되는 판단은 엔진이 servedPaths를 보고 직접 한다.
 */
const breakHealthCheckPath: Fault = (state) => {
  const group = state.aws?.targetGroups?.find((g) => g.arn === TG_ARN);
  if (!group) throw new Error("타깃 그룹을 찾을 수 없습니다");
  group.healthCheckPath = "/healthz"; // 실제 앱은 /health 로 서빙한다
};

export const awsAlbHealthcheck: Scenario = {
  id: "aws-alb-healthcheck",
  title: "로드밸런서가 503만 돌려줘요",
  category: "aws",
  difficulty: 2,

  ticket: [
    "쇼핑몰 주소로 접속하면 '503 Service Temporarily Unavailable' 만 뜹니다.",
    "EC2 인스턴스에 직접 접속해서 확인해 보면 애플리케이션은 정상적으로 응답합니다.",
    "어제 인프라 팀에서 헬스체크 설정을 표준화한다고 뭔가 바꿨다고 하는데 관련이 있을까요?",
    "급합니다. 확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "ALB의 503은 대부분 '보낼 곳이 없다'는 뜻임을 안다",
    "타깃 헬스 상태와 그 이유(Reason)를 조회해 원인을 좁힌다",
    "헬스체크 경로가 애플리케이션이 실제로 서빙하는 경로와 일치해야 한다는 것을 안다",
  ],

  host: "aws-admin",
  commands: withCommands("aws", "curl"),

  faults: [
    breakHealthCheckPath,
    logLine("monitoring-agent", "ALB shop-alb: HTTPCode_ELB_503_Count = 1842 in last 5 minutes", {
      priority: "err",
      offsetMs: -900_000,
    }),
    logLine("monitoring-agent", "ALB shop-alb: HealthyHostCount = 0", {
      priority: "err",
      offsetMs: -900_000,
    }),
  ],

  rootCause: {
    answerId: "healthcheck-path",
    choices: [
      {
        id: "healthcheck-path",
        label: "타깃 그룹의 헬스체크 경로가 애플리케이션이 서빙하지 않는 경로(/healthz)로 설정되어, 모든 타깃이 unhealthy로 빠졌다",
      },
      {
        id: "app-down",
        label: "EC2 인스턴스의 애플리케이션이 죽어서 응답하지 못한다",
        whyWrong:
          "인스턴스에 직접 접속하면 애플리케이션은 정상 응답합니다. describe-target-health의 Reason도 응답 코드 불일치를 가리킵니다 — 서버는 응답했지만 404를 돌려줬다는 뜻입니다.",
      },
      {
        id: "sg-blocked",
        label: "보안그룹이 ALB에서 인스턴스로 가는 트래픽을 막고 있다",
        whyWrong:
          "보안그룹에 막혔다면 헬스체크가 타임아웃되고 Reason이 Target.Timeout 으로 나옵니다. 여기서는 응답을 받긴 받았습니다.",
      },
      {
        id: "no-targets",
        label: "타깃 그룹에 등록된 인스턴스가 하나도 없다",
        whyWrong:
          "describe-target-health 를 보면 타깃은 등록되어 있습니다. 다만 상태가 unhealthy 일 뿐입니다.",
      },
    ],
  },

  hints: [
    "ALB가 503을 돌려준다는 건 대개 '요청을 넘길 정상 타깃이 하나도 없다'는 뜻입니다. 로드밸런서는 어떤 기준으로 타깃이 정상인지 판단할까요?",
    "`aws elbv2 describe-target-health --target-group-arn <값>` 으로 타깃 상태와 그 이유를 볼 수 있습니다. 타깃 그룹 ARN은 `aws elbv2 describe-target-groups` 로 찾으세요.",
    "타깃이 unhealthy이고 이유가 '응답 코드 불일치(404)' 입니다. 헬스체크 경로가 /healthz 로 되어 있는데, 애플리케이션이 실제로 서빙하는 건 /health 입니다. `aws elbv2 modify-target-group --target-group-arn <값> --health-check-path /health` 로 고치세요.",
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
      "타깃 그룹의 헬스체크 경로가 /health 에서 /healthz 로 변경되었습니다. 애플리케이션은 /healthz 를 서빙하지 않으므로 404를 돌려줬고, ALB는 응답 코드가 기대값(200)과 다르다는 이유로 모든 타깃을 unhealthy로 표시했습니다. 정상 타깃이 하나도 없어지자 ALB는 들어오는 모든 요청에 503을 반환했습니다. 애플리케이션 자체는 처음부터 끝까지 정상이었습니다.",
    whyItHappened:
      "헬스체크 경로를 표준화하면서 애플리케이션이 실제로 어떤 경로를 서빙하는지 확인하지 않았습니다. 설정을 바꾼 뒤 타깃 헬스 상태를 확인하지 않아, 변경이 장애로 이어지는 것을 즉시 알아차리지 못했습니다.",
    howToFix:
      "헬스체크 경로를 애플리케이션이 실제로 서빙하는 /health 로 되돌립니다. 변경 후에는 타깃이 healthy로 돌아오는지 확인해야 합니다 — 설정 변경이 반영되기까지 헬스체크 간격만큼 시간이 걸립니다.",
    howToPrevent: [
      "1) 헬스체크 설정을 바꾼 뒤 반드시 타깃 헬스 상태를 확인합니다. '명령이 성공했다'와 '서비스가 정상이다'는 다릅니다.",
      "2) HealthyHostCount 메트릭에 알림을 겁니다. 0이 되는 순간 즉시 알아야 합니다.",
      "3) 인프라를 코드로 관리해 헬스체크 경로가 애플리케이션 코드와 함께 리뷰되게 합니다.",
      "4) 변경을 한 번에 전체가 아니라 단계적으로 적용합니다.",
    ].join("\n"),
    realWorldNote:
      "ALB가 내는 5xx는 구분해서 봐야 합니다. 503은 보통 '정상 타깃 없음', 502는 '타깃이 이상한 응답을 줌', 504는 '타깃이 제때 응답하지 않음'입니다. CloudWatch의 HTTPCode_ELB_5XX(로드밸런서가 만든 에러)와 HTTPCode_Target_5XX(애플리케이션이 만든 에러)를 구분하는 것도 같은 이유로 중요합니다.",
  },
};
