import { withCommands } from "../engine/commands";
import { iamRoleHasPolicy } from "../engine/judge";
import { logLine, putFile } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

const ROLE = "shop-web-role";
const POLICY = "AmazonS3FullAccess";

export const awsIamS3: Scenario = {
  id: "aws-iam-s3",
  title: "상품 이미지 업로드가 전부 실패해요",
  category: "aws",
  difficulty: 2,

  ticket: [
    "상품 등록할 때 이미지 업로드가 계속 실패합니다. 오늘 아침부터입니다.",
    "앱 로그에는 'AccessDenied' 라고 찍혀 있는데 무슨 뜻인지 모르겠습니다.",
    "S3 버킷은 분명히 존재하고, 제 개인 계정으로는 콘솔에서 업로드가 잘 됩니다.",
    "어제 보안팀에서 IAM 권한을 정리했다고 하던데 관계가 있을까요?",
  ].join("\n"),

  learningObjectives: [
    "AccessDenied가 '누가 무엇에 대해' 거부당한 것인지 읽는 법을 익힌다",
    "EC2에서 동작하는 앱이 어떤 신원으로 AWS를 호출하는지 이해한다 (인스턴스 역할)",
    "IAM 역할에 붙은 정책을 조회하고 필요한 권한을 추가한다",
  ],

  host: "aws-admin",
  commands: withCommands("aws", "curl"),

  faults: [
    putFile("/var/log/app/upload.log", {
      sizeKB: 88,
      content:
        [
          "2026-09-11 09:12:41 ERROR [upload-worker-1] S3Uploader - PutObject failed: AccessDenied",
          "  User: arn:aws:sts::123456789012:assumed-role/shop-web-role/i-09f8e7d6c5b4a3210",
          "  is not authorized to perform: s3:PutObject on resource:",
          '  "arn:aws:s3:::shop-product-images/items/40213/main.jpg"',
          "  because no identity-based policy allows the s3:PutObject action",
          "2026-09-11 09:13:02 INFO  [health-check] HealthController - GET /health 200 (1ms)",
          "2026-09-11 09:14:18 ERROR [upload-worker-2] S3Uploader - PutObject failed: AccessDenied",
        ].join("\n") + "\n",
      mtimeOffsetMs: -120_000,
    }),
    logLine("monitoring-agent", "shop-api: upload_failure_rate = 100% in last 15 minutes", {
      priority: "err",
      offsetMs: -900_000,
    }),
  ],

  rootCause: {
    answerId: "role-missing-policy",
    choices: [
      {
        id: "role-missing-policy",
        label: "EC2에 붙은 IAM 역할(shop-web-role)에 S3 쓰기 권한이 없어, 앱이 업로드를 거부당하고 있다",
      },
      {
        id: "bucket-missing",
        label: "S3 버킷이 삭제되어 존재하지 않는다",
        whyWrong:
          "버킷이 없으면 NoSuchBucket 에러가 납니다. AccessDenied 는 '버킷은 있지만 너에게 권한이 없다'는 뜻입니다.",
      },
      {
        id: "credentials-expired",
        label: "앱에 설정된 액세스 키가 만료되었다",
        whyWrong:
          "키가 만료되거나 잘못됐다면 InvalidAccessKeyId 나 SignatureDoesNotMatch 가 납니다. 로그를 보면 신원은 정상적으로 확인되었고(assumed-role/shop-web-role), 그 신원에 권한이 없다는 내용입니다.",
      },
      {
        id: "network",
        label: "보안그룹이 S3로 나가는 트래픽을 막고 있다",
        whyWrong:
          "네트워크에 막혔다면 연결 타임아웃이 납니다. AccessDenied 라는 응답을 받았다는 건 S3까지 요청이 도달해서 거부당했다는 뜻입니다.",
      },
    ],
  },

  hints: [
    "AccessDenied 는 네트워크 문제도, 버킷이 없는 것도 아닙니다. 요청은 S3까지 잘 도착했고 거부당한 겁니다. 그렇다면 물어볼 것은 '누가 요청했는가'입니다. EC2에서 도는 앱은 어떤 신원으로 AWS를 호출할까요?",
    "앱 로그의 에러 메시지를 끝까지 읽어보세요. `User: ...assumed-role/...` 부분에 신원이 그대로 적혀 있습니다. 그 역할에 어떤 정책이 붙어 있는지는 `aws iam list-attached-role-policies --role-name <역할이름>` 으로 볼 수 있습니다.",
    "shop-web-role 에는 CloudWatch와 SSM 정책만 붙어 있고 S3 관련 권한이 없습니다. `aws iam attach-role-policy --role-name shop-web-role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess` 로 권한을 추가할 수 있습니다.",
  ],

  resolution: iamRoleHasPolicy(ROLE, POLICY),

  solutionPath: [
    "tail -n 10 /var/log/app/upload.log",
    "aws sts get-caller-identity",
    "aws ec2 describe-instances",
    `aws iam list-attached-role-policies --role-name ${ROLE}`,
    `aws iam attach-role-policy --role-name ${ROLE} --policy-arn arn:aws:iam::aws:policy/${POLICY}`,
    `aws iam list-attached-role-policies --role-name ${ROLE}`,
  ],

  postmortem: {
    whatHappened:
      "EC2 인스턴스에 연결된 IAM 역할 shop-web-role 에서 S3 관련 권한이 제거되었습니다. 애플리케이션은 이 역할의 임시 자격증명으로 S3를 호출하기 때문에, s3:PutObject 요청이 전부 AccessDenied 로 거부되었습니다. 버킷도 네트워크도 정상이었고, 오직 권한만 없는 상태였습니다.",
    whyItHappened:
      "보안팀이 과도한 권한을 정리하는 과정에서 실제로 사용 중인 권한까지 함께 제거했습니다. 어떤 역할이 어떤 API를 실제로 호출하고 있는지 확인하지 않고 정책을 뗐고, 변경 후 애플리케이션 동작을 검증하지 않았습니다.",
    howToFix:
      "역할에 S3 쓰기 권한을 다시 붙입니다. 다만 AmazonS3FullAccess 는 모든 버킷에 대한 전체 권한이라 응급 조치용입니다. 정상화된 뒤에는 필요한 버킷의 필요한 동작만 허용하는 전용 정책으로 교체해야 합니다.",
    howToPrevent: [
      "1) 권한을 줄이기 전에 실제 사용 내역을 확인합니다. IAM Access Advisor 나 CloudTrail 로 그 역할이 최근에 무엇을 호출했는지 볼 수 있습니다.",
      "2) 최소 권한 정책을 직접 작성합니다 — 특정 버킷의 s3:PutObject, s3:GetObject 만 허용하는 식입니다.",
      "3) IAM 변경도 인프라 코드로 관리해 리뷰와 이력이 남게 합니다.",
      "4) 권한 변경 후에는 스테이징에서 주요 기능을 실제로 실행해 검증합니다.",
      "5) 업로드 실패율을 모니터링해 100%가 되면 즉시 알림이 오게 합니다.",
    ].join("\n"),
    realWorldNote:
      "AWS 에러 메시지는 생각보다 친절합니다. 'User A is not authorized to perform: B on resource: C' 형식에서 A(누가), B(무엇을), C(어디에)가 그대로 나옵니다. 이 세 가지만 읽으면 어느 역할에 어떤 권한을 줘야 하는지 바로 알 수 있습니다. AccessDenied 를 만나면 메시지를 끝까지 읽으세요.",
  },
};
