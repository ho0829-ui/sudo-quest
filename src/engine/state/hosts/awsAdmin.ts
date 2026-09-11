/**
 * AWS 시나리오용 프리셋.
 *
 * 여기서 플레이어는 서버 안이 아니라 **운영용 작업 서버(bastion)** 에 있다.
 * AWS CLI로 클라우드 리소스를 조회하고 고치는 상황이다.
 */
import { ensureDir, findNode, writeFile } from "../fs";
import type { DirNode, SystemState } from "../types";

export const AWS_CLOCK = Date.UTC(2026, 8, 11, 10, 30, 0);

const GB = 1024 * 1024;

export function awsAdmin(): SystemState {
  const root: DirNode = {
    kind: "dir",
    name: "/",
    owner: "root",
    group: "root",
    mode: 0o755,
    mtime: AWS_CLOCK,
    children: [],
  };

  for (const dir of ["/etc", "/var/log", "/home/ubuntu/.aws"]) ensureDir(root, dir);

  const home = findNode(root, "/home/ubuntu");
  if (home?.kind === "dir") {
    home.owner = "ubuntu";
    home.group = "ubuntu";
  }
  const awsDir = findNode(root, "/home/ubuntu/.aws");
  if (awsDir?.kind === "dir") {
    awsDir.owner = "ubuntu";
    awsDir.group = "ubuntu";
  }

  writeFile(root, "/etc/resolv.conf", {
    content: "nameserver 10.0.0.2\nsearch ap-northeast-2.compute.internal\n",
  });
  writeFile(root, "/home/ubuntu/.aws/config", {
    content: "[default]\nregion = ap-northeast-2\noutput = json\n",
    owner: "ubuntu",
    group: "ubuntu",
  });

  return {
    hostname: "ops-bastion",
    clock: AWS_CLOCK,
    user: "ubuntu",
    cwd: "/home/ubuntu",
    fs: root,
    disks: [{ device: "/dev/root", mount: "/", totalKB: 16 * GB, reservedKB: 3.2 * GB }],
    memory: { totalKB: 4 * GB, reservedKB: 420 * 1024 },
    services: [],
    processes: [
      { pid: 1, user: "root", cpu: 0, memKB: 12 * 1024, command: "/sbin/init" },
      {
        pid: 806,
        user: "root",
        cpu: 0,
        memKB: 9 * 1024,
        command: "/usr/sbin/sshd -D",
        listenPorts: [{ addr: "0.0.0.0", port: 22 }],
      },
    ],
    network: {
      interfaces: [
        { name: "lo", addr: "127.0.0.1" },
        { name: "eth0", addr: "10.0.1.5" },
      ],
      firewall: {
        enabled: true,
        defaultIncoming: "deny",
        defaultOutgoing: "allow",
        rules: [{ port: 22, proto: "tcp", action: "allow", comment: "SSH" }],
      },
      dnsServers: ["10.0.0.2"],
      records: {},
      world: [],
    },
    journal: [
      {
        time: AWS_CLOCK - 1800_000,
        tag: "sshd",
        pid: 1802,
        priority: "info",
        message: "Accepted publickey for ubuntu from 10.0.1.55 port 51102 ssh2",
      },
    ],
    aws: {
      region: "ap-northeast-2",
      accountId: "123456789012",
      callerArn: "arn:aws:iam::123456789012:user/ops-engineer",
      instances: [
        {
          instanceId: "i-0a1b2c3d4e5f60718",
          name: "shop-web-02",
          instanceType: "t3.small",
          state: "running",
          privateIp: "10.0.2.31",
          publicIp: "3.35.120.77",
          securityGroupIds: ["sg-0f1e2d3c4b5a69788"],
          subnetId: "subnet-0aa11bb22cc33dd44",
          keyName: "ops-keypair",
        },
        {
          instanceId: "i-09f8e7d6c5b4a3210",
          name: "shop-web-01",
          instanceType: "t3.small",
          state: "running",
          privateIp: "10.0.2.10",
          publicIp: "3.35.118.12",
          securityGroupIds: ["sg-00112233445566778"],
          subnetId: "subnet-0aa11bb22cc33dd44",
          keyName: "ops-keypair",
        },
      ],
      securityGroups: [
        {
          groupId: "sg-0f1e2d3c4b5a69788",
          groupName: "shop-web-new-sg",
          description: "Security group for shop-web-02",
          ingress: [],
          egress: [{ protocol: "-1", fromPort: 0, toPort: 65535, cidr: "0.0.0.0/0" }],
        },
        {
          groupId: "sg-00112233445566778",
          groupName: "shop-web-sg",
          description: "Security group for shop-web-01",
          ingress: [
            { protocol: "tcp", fromPort: 22, toPort: 22, cidr: "10.0.1.0/24", description: "SSH from bastion" },
            { protocol: "tcp", fromPort: 80, toPort: 80, cidr: "0.0.0.0/0", description: "HTTP" },
          ],
          egress: [{ protocol: "-1", fromPort: 0, toPort: 65535, cidr: "0.0.0.0/0" }],
        },
      ],
    },
  };
}
