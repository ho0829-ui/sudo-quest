/** 구현한 API별 옵션만 허용한다. 오타나 dry-run을 무시하고 실제 변경하는 것을 막는다. */
const OPTIONS: Record<string, readonly string[]> = {
  "ec2 describe-instances": ["instance-ids"],
  "ec2 describe-security-groups": ["group-id", "group-ids"],
  "ec2 authorize-security-group-ingress": ["group-id", "protocol", "port", "cidr", "dry-run", "no-dry-run"],
  "elbv2 describe-load-balancers": [],
  "elbv2 describe-target-groups": ["target-group-arns", "target-group-arn"],
  "elbv2 describe-target-health": ["target-group-arn"],
  "elbv2 modify-target-group": ["target-group-arn", "health-check-path"],
  "iam list-roles": [],
  "iam list-attached-role-policies": ["role-name"],
  "iam attach-role-policy": ["role-name", "policy-arn"],
  "sts get-caller-identity": [],
};

export function parseAwsOptions(tokens: string[], operation: string): { options: Record<string, string>; error?: string } {
  const options: Record<string, string> = {};
  const allowed = OPTIONS[operation];
  if (!allowed) return { options }; // 하위 명령 오류는 aws 진입점이 기존 CLI 형식으로 처리한다.
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i];
    const separator = token.indexOf("=");
    const key = separator === -1 ? token.slice(2) : token.slice(2, separator);
    if (!token.startsWith("--") || !allowed.includes(key)) return { options, error: `Unknown options: ${token}` };
    if (key === "dry-run" || key === "no-dry-run") {
      if (separator !== -1) return { options, error: `argument --${key}: ignored explicit argument` };
      options[key] = "true";
      continue;
    }
    const value = separator === -1 ? tokens[++i] : token.slice(separator + 1);
    if (!value || value.startsWith("--")) return { options, error: `argument --${key}: expected one argument` };
    options[key] = value;
  }
  if (options["dry-run"] && options["no-dry-run"]) return { options, error: "argument --no-dry-run: not allowed with argument --dry-run" };
  return { options };
}

export function validIpv4Cidr(cidr: string): boolean {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr);
  return !!match && match[1].split(".").every(part => Number(part) <= 255) && Number(match[2]) <= 32;
}
