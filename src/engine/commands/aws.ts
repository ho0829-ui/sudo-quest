/**
 * AWS CLI.
 *
 * 출력은 실제 aws CLI처럼 JSON이다. 읽기 불편해 보여도,
 * 실무에서 보게 될 형태 그대로 익히는 게 이 게임의 목적이다.
 */
import { positionals } from "../parser/parse";
import type { SecurityGroup, SecurityGroupRule, SystemState } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

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

export const aws: Command = {
  name: "aws",
  summary: "AWS 리소스를 조회하고 수정한다 (ec2 / sts)",
  usage: "aws <ec2|sts> <하위명령> [--옵션 값]",
  run({ state, tokens }: CommandContext) {
    const args = positionals(tokens, ["group-id", "group-ids", "protocol", "port", "cidr", "instance-ids"]);
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
