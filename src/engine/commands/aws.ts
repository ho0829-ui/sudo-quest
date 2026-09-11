/**
 * AWS CLI.
 *
 * 출력은 실제 aws CLI처럼 JSON이다. 읽기 불편해 보여도,
 * 실무에서 보게 될 형태 그대로 익히는 게 이 게임의 목적이다.
 */
import { positionals } from "../parser/parse";
import { targetHealth } from "../state/aws";
import type { SecurityGroup, SecurityGroupRule, SystemState } from "../state/types";
import { fail, ok, type Command, type CommandContext, type CommandResult } from "./types";

/** "--group-id sg-123 --port 22" 같은 긴 옵션들을 뽑아낸다. */
function options(tokens: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=");
    const value = inlineValue ?? (tokens[i + 1]?.startsWith("--") ? "" : tokens[i + 1]);
    result[key] = value ?? "";
  }
  return result;
}

const json = (value: unknown) => JSON.stringify(value, null, 4);

function requireAws(state: SystemState) {
  if (!state.aws) {
    throw new Error("이 호스트에는 AWS 리소스가 없습니다 (프리셋 설정 문제)");
  }
  return state.aws;
}

function ipPermission(rule: SecurityGroupRule) {
  return {
    IpProtocol: rule.protocol,
    ...(rule.protocol === "-1" ? {} : { FromPort: rule.fromPort, ToPort: rule.toPort }),
    IpRanges: [{ CidrIp: rule.cidr, ...(rule.description ? { Description: rule.description } : {}) }],
    Ipv6Ranges: [],
    UserIdGroupPairs: [],
  };
}

function securityGroupJson(group: SecurityGroup, accountId: string) {
  return {
    GroupId: group.groupId,
    GroupName: group.groupName,
    Description: group.description,
    OwnerId: accountId,
    VpcId: "vpc-0abc123def456789a",
    IpPermissions: group.ingress.map(ipPermission),
    IpPermissionsEgress: group.egress.map(ipPermission),
  };
}

/** aws elbv2 — 로드밸런서와 타깃 그룹 */
function elbv2(state: SystemState, operation: string | undefined, opts: Record<string, string>): CommandResult {
  const cloud = requireAws(state);
  const groups = cloud.targetGroups ?? [];

  if (operation === "describe-load-balancers") {
    return ok(
      json({
        LoadBalancers: (cloud.loadBalancers ?? []).map((lb) => ({
          LoadBalancerArn: lb.arn,
          LoadBalancerName: lb.name,
          DNSName: lb.dnsName,
          Scheme: "internet-facing",
          Type: "application",
          State: { Code: "active" },
        })),
      }),
    );
  }

  if (operation === "describe-target-groups") {
    const wanted = opts["target-group-arns"] ?? opts["target-group-arn"];
    const found = groups.filter((g) => !wanted || g.arn === wanted);
    return ok(
      json({
        TargetGroups: found.map((g) => ({
          TargetGroupArn: g.arn,
          TargetGroupName: g.name,
          Protocol: g.protocol,
          Port: g.port,
          HealthCheckProtocol: g.protocol,
          HealthCheckPort: g.healthCheckPort,
          HealthCheckEnabled: true,
          HealthCheckIntervalSeconds: 30,
          HealthCheckTimeoutSeconds: 5,
          HealthyThresholdCount: 5,
          UnhealthyThresholdCount: 2,
          HealthCheckPath: g.healthCheckPath,
          Matcher: { HttpCode: "200" },
        })),
      }),
    );
  }

  if (operation === "describe-target-health") {
    const wanted = opts["target-group-arn"];
    const group = groups.find((g) => g.arn === wanted);
    if (!group) {
      return fail(
        `An error occurred (TargetGroupNotFound) when calling the DescribeTargetHealth operation: Target groups '${wanted ?? ""}' not found`,
        254,
      );
    }
    return ok(
      json({
        TargetHealthDescriptions: targetHealth(state, group).map((t) => ({
          Target: { Id: t.instanceId, Port: t.port },
          HealthCheckPort: String(group.healthCheckPort),
          TargetHealth: {
            State: t.state,
            ...(t.reason ? { Reason: t.reason } : {}),
            ...(t.description ? { Description: t.description } : {}),
          },
        })),
      }),
    );
  }

  if (operation === "modify-target-group") {
    const wanted = opts["target-group-arn"];
    const group = groups.find((g) => g.arn === wanted);
    if (!group) {
      return fail(
        `An error occurred (TargetGroupNotFound) when calling the ModifyTargetGroup operation: Target groups '${wanted ?? ""}' not found`,
        254,
      );
    }
    const path = opts["health-check-path"];
    if (!path) return fail("ModifyTargetGroup: --health-check-path 가 필요합니다", 254);
    if (!path.startsWith("/")) {
      return fail(
        `An error occurred (ValidationError) when calling the ModifyTargetGroup operation: Health check path must begin with a '/'`,
        254,
      );
    }
    group.healthCheckPath = path;
    return ok(json({ TargetGroups: [{ TargetGroupArn: group.arn, HealthCheckPath: group.healthCheckPath }] }));
  }

  return fail(
    `usage: aws elbv2 <subcommand>\nUnknown subcommand: ${operation ?? "(없음)"}\n` +
      "지원: describe-load-balancers, describe-target-groups, describe-target-health, modify-target-group",
    252,
  );
}

/** aws iam — 역할과 정책 */
function iam(state: SystemState, operation: string | undefined, opts: Record<string, string>): CommandResult {
  const roles = requireAws(state).roles ?? [];

  if (operation === "list-roles") {
    return ok(json({ Roles: roles.map((r) => ({ RoleName: r.name, Arn: r.arn })) }));
  }

  if (operation === "list-attached-role-policies") {
    const name = opts["role-name"];
    const role = roles.find((r) => r.name === name);
    if (!role) {
      return fail(
        `An error occurred (NoSuchEntity) when calling the ListAttachedRolePolicies operation: The role with name ${name ?? ""} cannot be found.`,
        254,
      );
    }
    return ok(
      json({
        AttachedPolicies: role.attachedPolicies.map((policy) => ({
          PolicyName: policy,
          PolicyArn: `arn:aws:iam::aws:policy/${policy}`,
        })),
      }),
    );
  }

  if (operation === "attach-role-policy") {
    const name = opts["role-name"];
    const role = roles.find((r) => r.name === name);
    if (!role) {
      return fail(
        `An error occurred (NoSuchEntity) when calling the AttachRolePolicy operation: The role with name ${name ?? ""} cannot be found.`,
        254,
      );
    }
    const arn = opts["policy-arn"];
    if (!arn) return fail("AttachRolePolicy: --policy-arn 이 필요합니다", 254);
    const policy = arn.split("/").pop() ?? arn;
    if (!role.attachedPolicies.includes(policy)) role.attachedPolicies.push(policy);
    return ok("");
  }

  return fail(
    `usage: aws iam <subcommand>\nUnknown subcommand: ${operation ?? "(없음)"}\n` +
      "지원: list-roles, list-attached-role-policies, attach-role-policy",
    252,
  );
}

export const aws: Command = {
  name: "aws",
  summary: "AWS 리소스를 조회하고 수정한다 (ec2 / elbv2 / iam / sts)",
  usage: "aws <ec2|elbv2|iam|sts> <하위명령> [--옵션 값]",
  run({ state, tokens }: CommandContext) {
    // 값을 받는 긴 옵션들. 이 목록에 없으면 옵션의 값이 하위명령으로 잘못 읽힌다.
    const VALUE_OPTIONS = [
      "group-id", "group-ids", "protocol", "port", "cidr", "instance-ids",
      "target-group-arn", "target-group-arns", "health-check-path",
      "role-name", "policy-arn",
    ];
    const args = positionals(tokens, VALUE_OPTIONS);
    const service = args[0];
    const operation = args[1];
    const opts = options(tokens);
    const cloud = requireAws(state);

    if (service === "sts" && operation === "get-caller-identity") {
      return ok(
        json({
          UserId: "AIDACKCEVSQ6C2EXAMPLE",
          Account: cloud.accountId,
          Arn: cloud.callerArn,
        }),
      );
    }

    if (service === "elbv2") return elbv2(state, operation, opts);
    if (service === "iam") return iam(state, operation, opts);

    if (service !== "ec2") {
      return fail(`usage: aws <command> <subcommand> [parameters]\nUnknown service: ${service ?? "(없음)"}`, 252);
    }

    if (operation === "describe-instances") {
      const wanted = opts["instance-ids"];
      const instances = cloud.instances.filter((i) => !wanted || i.instanceId === wanted);
      return ok(
        json({
          Reservations: instances.map((instance) => ({
            ReservationId: "r-0123456789abcdef0",
            Instances: [
              {
                InstanceId: instance.instanceId,
                InstanceType: instance.instanceType,
                State: { Code: instance.state === "running" ? 16 : 80, Name: instance.state },
                PrivateIpAddress: instance.privateIp,
                ...(instance.publicIp ? { PublicIpAddress: instance.publicIp } : {}),
                SubnetId: instance.subnetId,
                KeyName: instance.keyName,
                SecurityGroups: instance.securityGroupIds.map((id) => ({
                  GroupId: id,
                  GroupName: cloud.securityGroups.find((g) => g.groupId === id)?.groupName ?? "unknown",
                })),
                ...(instance.iamRole
                  ? { IamInstanceProfile: { Arn: `arn:aws:iam::${cloud.accountId}:instance-profile/${instance.iamRole}` } }
                  : {}),
                Tags: [{ Key: "Name", Value: instance.name }],
              },
            ],
          })),
        }),
      );
    }

    if (operation === "describe-security-groups") {
      const wanted = opts["group-ids"] ?? opts["group-id"];
      const groups = cloud.securityGroups.filter((g) => !wanted || g.groupId === wanted);
      if (wanted && groups.length === 0) {
        return fail(
          `An error occurred (InvalidGroup.NotFound) when calling the DescribeSecurityGroups operation: The security group '${wanted}' does not exist`,
          254,
        );
      }
      return ok(json({ SecurityGroups: groups.map((g) => securityGroupJson(g, cloud.accountId)) }));
    }

    if (operation === "authorize-security-group-ingress") {
      const groupId = opts["group-id"];
      const group = cloud.securityGroups.find((g) => g.groupId === groupId);
      if (!group) {
        return fail(
          `An error occurred (InvalidGroup.NotFound) when calling the AuthorizeSecurityGroupIngress operation: The security group '${groupId ?? ""}' does not exist`,
          254,
        );
      }

      const protocol = opts["protocol"] ?? "tcp";
      const port = Number(opts["port"]);
      const cidr = opts["cidr"];
      if (!cidr || (protocol !== "-1" && !Number.isInteger(port))) {
        return fail(
          "An error occurred (MissingParameter) when calling the AuthorizeSecurityGroupIngress operation: --port 와 --cidr 가 필요합니다",
          254,
        );
      }

      const duplicate = group.ingress.some(
        (r) => r.protocol === protocol && r.fromPort === port && r.cidr === cidr,
      );
      if (duplicate) {
        return fail(
          `An error occurred (InvalidPermission.Duplicate) when calling the AuthorizeSecurityGroupIngress operation: the specified rule already exists`,
          254,
        );
      }

      group.ingress.push({ protocol, fromPort: port, toPort: port, cidr });
      return ok(json({ Return: true }));
    }

    return fail(
      `usage: aws ec2 <subcommand>\nUnknown subcommand: ${operation ?? "(없음)"}\n` +
        "지원: describe-instances, describe-security-groups, authorize-security-group-ingress",
      252,
    );
  },
};
