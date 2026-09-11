import { withCommands } from "../engine/commands";
import { securityGroupAllows } from "../engine/judge";
import { logLine } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** 새로 만든 인스턴스에 붙은 보안그룹. 인바운드 규칙이 비어 있다. */
const NEW_SG = "sg-0f1e2d3c4b5a69788";

export const awsSecurityGroup: Scenario = {
  id: "aws-security-group",
  title: "새로 만든 EC2에 SSH가 안 붙어요",
  category: "aws",
  difficulty: 1,

  ticket: [
    "어제 증설용으로 EC2 인스턴스를 하나 새로 만들었습니다 (shop-web-02).",
    "그런데 bastion에서 SSH로 접속하려고 하면 계속 멈춰 있다가 timeout이 납니다.",
    "키 파일은 기존 서버에 쓰던 것과 같은 걸 쓰고 있고, 인스턴스는 콘솔에서 running 으로 보입니다.",
    "기존 서버(shop-web-01)에는 잘 붙습니다. 뭐가 다른 걸까요?",
  ].join("\n"),

  learningObjectives: [
    "접속 실패를 서버 안이 아니라 클라우드 네트워크 계층에서 확인하는 법을 익힌다",
    "정상 리소스와 비교해서 차이를 찾아내는 접근법을 쓴다",
    "보안그룹 인바운드 규칙을 AWS CLI로 조회하고 추가한다",
  ],

  host: "aws-admin",
  commands: withCommands("aws", "ss", "curl"),

  faults: [
    // 프리셋의 새 인스턴스는 이미 인바운드 규칙이 비어 있는 상태다.
    // 여기서는 상황을 만든 흔적(로그)만 남긴다.
    logLine("ssh", "connect to host 10.0.2.31 port 22: Connection timed out", {
      priority: "warning",
      offsetMs: -900_000,
      pid: 3140,
    }),
    logLine("ssh", "connect to host 10.0.2.31 port 22: Connection timed out", {
      priority: "warning",
      offsetMs: -300_000,
      pid: 3208,
    }),
  ],

  rootCause: {
    answerId: "sg-no-ingress",
    choices: [
      {
        id: "sg-no-ingress",
        label: "새 인스턴스에 붙은 보안그룹(shop-web-new-sg)에 22번 포트 인바운드 규칙이 없어 SSH 접속이 차단되고 있다",
      },
      {
        id: "instance-stopped",
        label: "인스턴스가 실제로는 정지 상태라 접속할 수 없다",
        whyWrong:
          "describe-instances 결과를 보면 State가 running 입니다. 정지된 인스턴스라면 timeout이 아니라 아예 주소가 없습니다.",
      },
      {
        id: "wrong-key",
        label: "키 페어가 달라 인증에 실패하고 있다",
        whyWrong:
          "키가 틀렸다면 'Permission denied (publickey)' 가 즉시 뜹니다. timeout은 인증 단계까지 가지도 못했다는 뜻입니다.",
      },
      {
        id: "sshd-down",
        label: "새 인스턴스 안에서 sshd 데몬이 꺼져 있다",
        whyWrong:
          "sshd가 꺼져 있으면 연결이 '거부(Connection refused)' 됩니다. timeout은 패킷이 인스턴스에 닿기도 전에 버려졌다는 신호입니다.",
      },
    ],
  },

  hints: [
    "접속이 '거부'되는 게 아니라 '멈춰 있다가 timeout' 이라는 점에 주목하세요. 이건 요청이 목적지까지 아예 닿지 못했다는 뜻입니다. AWS에서 트래픽을 막을 수 있는 곳은 어디일까요?",
    "`aws ec2 describe-instances` 로 두 인스턴스를 비교해 보세요. 각각 어떤 보안그룹이 붙어 있나요? 그다음 `aws ec2 describe-security-groups --group-id <값>` 으로 규칙을 확인합니다.",
    "새 인스턴스의 보안그룹은 IpPermissions(인바운드)가 비어 있습니다. 기존 서버 것과 비교해 보세요. `aws ec2 authorize-security-group-ingress --group-id <값> --protocol tcp --port 22 --cidr 10.0.1.0/24` 로 규칙을 추가할 수 있습니다.",
  ],

  resolution: securityGroupAllows(NEW_SG, 22),

  solutionPath: [
    "aws sts get-caller-identity",
    "aws ec2 describe-instances",
    `aws ec2 describe-security-groups --group-id ${NEW_SG}`,
    "aws ec2 describe-security-groups --group-id sg-00112233445566778",
    `aws ec2 authorize-security-group-ingress --group-id ${NEW_SG} --protocol tcp --port 22 --cidr 10.0.1.0/24`,
    `aws ec2 describe-security-groups --group-id ${NEW_SG}`,
  ],

  postmortem: {
    whatHappened:
      "새로 만든 EC2 인스턴스(shop-web-02)에 붙은 보안그룹 shop-web-new-sg 에 인바운드 규칙이 하나도 없었습니다. 보안그룹은 기본적으로 모든 인바운드를 거부하기 때문에, bastion에서 보낸 SSH 패킷이 인스턴스에 닿지 못하고 그대로 버려졌습니다. 그래서 인증 실패가 아니라 timeout으로 나타났습니다.",
    whyItHappened:
      "인스턴스를 콘솔에서 수동으로 만들면서 보안그룹을 새로 생성했고, 기존 서버에 적용된 규칙을 옮겨 넣지 않았습니다. 새 보안그룹은 아웃바운드는 전부 열려 있지만 인바운드는 비어 있는 상태로 만들어집니다.",
    howToFix:
      "필요한 인바운드 규칙을 추가합니다. SSH는 반드시 출발지를 제한해야 합니다 — bastion이 있는 대역(예: 10.0.1.0/24)만 허용하고, 0.0.0.0/0 으로는 절대 열지 않습니다.",
    howToPrevent: [
      "1) 인프라를 코드로 관리합니다 (Terraform, CloudFormation). 같은 역할의 서버가 같은 보안그룹을 쓰게 되어 이런 누락이 생기지 않습니다.",
      "2) 서버를 손으로 만들지 말고, 검증된 AMI와 런치 템플릿으로 찍어냅니다.",
      "3) 보안그룹을 서버마다 새로 만들지 말고 역할별로 공유합니다 (web-sg, db-sg, bastion-sg).",
      "4) SSH 22번을 0.0.0.0/0 으로 여는 보안그룹을 자동으로 찾아내는 점검을 겁니다 (AWS Config, Security Hub).",
    ].join("\n"),
    realWorldNote:
      "AWS에서 접속이 안 될 때 확인 순서는 대체로 정해져 있습니다. 보안그룹 → 네트워크 ACL → 라우팅 테이블 → 서브넷(퍼블릭/프라이빗) → 그다음에야 인스턴스 안입니다. timeout이면 네트워크 계층, Connection refused면 인스턴스 안을 의심하세요. 이 구분 하나로 조사 범위가 절반으로 줄어듭니다.",
  },
};
