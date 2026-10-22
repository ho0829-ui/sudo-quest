/**
 * 가상 시스템의 상태 모델.
 *
 * 핵심 원칙: 명령어 출력은 여기에 저장하지 않는다.
 * `df -h`의 사용량 같은 값은 저장된 값이 아니라 derived.ts에서 "계산"한다.
 * 그래야 플레이어가 파일을 지우면 df 결과가 저절로 바뀐다.
 */

import type { DockerState } from "./docker/types";
import type { KubernetesState } from "./kubernetes/types";

// ---------- 파일시스템 ----------

interface NodeBase {
  name: string;
  owner: string;
  group: string;
  /** 8진수 퍼미션. 예: 0o644 */
  mode: number;
  /** 마지막 수정 시각 (epoch ms) */
  mtime: number;
}

export interface FileNode extends NodeBase {
  kind: "file";
  /**
   * 파일 크기(KB). df/du 계산의 근거가 되는 "진짜" 크기다.
   * content와 일부러 분리했다. 7GB짜리 로그 파일의 내용을 전부 들고 있을 수는 없으니,
   * content에는 cat/tail로 보여줄 일부 줄만 담고 크기는 sizeKB로 따로 표현한다.
   */
  sizeKB: number;
  content: string;
}

export interface DirNode extends NodeBase {
  kind: "dir";
  children: FsNode[];
}

export type FsNode = FileNode | DirNode;

// ---------- 디스크 ----------

export interface Disk {
  device: string; // "/dev/root"
  mount: string; // "/"
  totalKB: number;
  /**
   * 파일시스템 트리로 표현하지 않은 기본 사용량(OS, 패키지 등).
   * 이게 없으면 새로 만든 서버의 디스크 사용량이 0%로 보여 비현실적이다.
   */
  reservedKB: number;
}

// ---------- 서비스 (systemd) ----------

export type ServiceState = "active" | "inactive" | "failed";

export interface Service {
  name: string; // "nginx"
  description: string;
  state: ServiceState;
  /** 부팅 시 자동 시작 여부 */
  enabled: boolean;
  unitPath: string; // "/lib/systemd/system/nginx.service"
  execStart: string;
  /** 현재 실행 중인 프로세스의 pid (active일 때만) */
  mainPid?: number;
  /** 마지막으로 상태가 바뀐 시각 */
  since: number;
  /** 시작에 성공하면 열게 되는 포트 */
  listenPorts?: { addr: string; port: number }[];
  /** 시작에 필요한 최소 여유 디스크. 부족하면 시작이 실패한다. */
  requiresFreeKB?: number;
  /**
   * 바인드 주소를 설정 파일에서 읽어온다.
   * 이게 있으면 listenPorts의 주소 대신 설정 파일의 값을 쓴다.
   * "설정을 고치고 재시작하면 바인딩이 바뀐다"가 여기서 재현된다.
   */
  bindConfig?: { path: string; key: string };
  /** 문법을 검사할 설정 파일 경로 */
  configPath?: string;
  /** 그 파일을 어떤 검증기로 볼지. configValidators의 키. */
  configValidator?: "nginx";
  /** 실패했을 때의 종료 코드/사유 (systemctl status에 표시) */
  lastExitReason?: string;
  memKB: number;
  cpu: number;
}

// ---------- 프로세스 ----------

export interface Process {
  pid: number;
  user: string;
  cpu: number;
  memKB: number;
  command: string;
  /** 이 프로세스가 붙잡고 있는 리스닝 소켓. ss -tlnp의 원본 데이터다. */
  listenPorts?: { addr: string; port: number }[];
  /** systemd 서비스가 띄운 프로세스면 서비스 이름 */
  service?: string;
  /** docker-proxy처럼 컨테이너로 연결을 넘기는 프로세스면 그 컨테이너 ID. 로컬 요청의 응답을 컨테이너가 만든다. */
  container?: string;
}

// ---------- 로그 ----------

export type LogPriority = "info" | "notice" | "warning" | "err";

export interface LogEntry {
  time: number;
  /** 로그를 남긴 프로그램 이름. journalctl 출력에서 대괄호 앞에 찍힌다. ("systemd", "nginx", "CRON") */
  tag: string;
  /**
   * 이 로그가 "어느 서비스에 대한 것인가". journalctl -u 가 이 값으로 거른다.
   * 실제 journald도 남긴 프로그램(_COMM)과 속한 유닛(_SYSTEMD_UNIT)을 따로 가진다.
   * 예: systemd가 "Failed to start nginx" 라고 남긴 로그는 tag="systemd", unit="nginx" 다.
   */
  unit?: string;
  pid?: number;
  priority: LogPriority;
  message: string;
}

// ---------- 네트워크 ----------

export interface NetworkInterface {
  name: string; // "lo", "eth0"
  addr: string;
}

export interface FirewallRule {
  port: number;
  proto: "tcp" | "udp";
  action: "allow" | "deny";
  /** 어디서 오는 요청에 적용할지. 생략하면 "Anywhere" */
  from?: string;
  comment?: string;
}

export interface Firewall {
  enabled: boolean;
  defaultIncoming: "allow" | "deny";
  defaultOutgoing: "allow" | "deny";
  rules: FirewallRule[];
}

/** 서버 바깥에 있는 호스트가 열어둔 서비스 */
export interface RemoteService {
  port: number;
  status?: number; // HTTP 응답 코드
  body?: string;
  /** TLS 인증서 만료 시각. 지나면 curl이 인증서 오류를 낸다. */
  tlsExpiresAt?: number;
}

export interface RemoteHost {
  ip: string;
  hostnames: string[];
  services: RemoteService[];
}

export interface Network {
  interfaces: NetworkInterface[];
  firewall: Firewall;
  /**
   * 실제로 응답하는 DNS 서버 목록.
   * /etc/resolv.conf 에 적힌 주소가 여기 없으면 이름 해석이 실패한다.
   * (설정 파일은 파일시스템에 있고, "그 설정이 맞는지"는 이 목록이 정한다)
   */
  dnsServers: string[];
  /** 가상 인터넷의 DNS 레코드: 도메인 → IP */
  records: Record<string, string>;
  world: RemoteHost[];
}

// ---------- 데이터베이스 ----------

/**
 * DB는 통째로 흉내 내지 않는다.
 * 트러블슈팅에 실제로 필요한 것 — 설정값과 현재 연결 수 — 만 모델링한다.
 */
export interface Database {
  kind: "mysql";
  version: string;
  variables: Record<string, string>;
  status: Record<string, string>;
}

// ---------- TLS 인증서 ----------

export interface Certificate {
  /** 인증서 파일 경로 */
  path: string;
  /** 이 인증서가 보증하는 도메인 */
  domain: string;
  issuer: string;
  notBefore: number;
  notAfter: number;
}

// ---------- AWS ----------

export interface SecurityGroupRule {
  /** "tcp", "udp", 또는 모든 프로토콜을 뜻하는 "-1" */
  protocol: string;
  fromPort: number;
  toPort: number;
  cidr: string;
  description?: string;
}

export interface SecurityGroup {
  groupId: string; // "sg-0a1b2c3d"
  groupName: string;
  description: string;
  ingress: SecurityGroupRule[];
  egress: SecurityGroupRule[];
}

export interface Ec2Instance {
  instanceId: string;
  name: string;
  instanceType: string;
  state: "running" | "stopped" | "pending";
  privateIp: string;
  publicIp?: string;
  securityGroupIds: string[];
  subnetId: string;
  keyName: string;
  /** 붙어 있는 IAM 인스턴스 프로파일 (권한 시나리오에서 쓴다) */
  iamRole?: string;
}

export interface TargetGroup {
  arn: string;
  name: string;
  port: number;
  protocol: string;
  /** 헬스체크가 때릴 경로. 이 경로가 타깃에 없으면 unhealthy가 된다. */
  healthCheckPath: string;
  healthCheckPort: string;
  /** 이 타깃 그룹에 등록된 인스턴스 id */
  targetIds: string[];
}

export interface LoadBalancer {
  arn: string;
  name: string;
  dnsName: string;
  /** 리스너가 트래픽을 넘기는 타깃 그룹 */
  targetGroupArn: string;
}

export interface IamRole {
  name: string;
  arn: string;
  /** 이 역할에 붙어 있는 관리형 정책 이름들 */
  attachedPolicies: string[];
}

export interface AwsState {
  region: string;
  accountId: string;
  callerArn: string;
  instances: Ec2Instance[];
  securityGroups: SecurityGroup[];
  loadBalancers?: LoadBalancer[];
  targetGroups?: TargetGroup[];
  roles?: IamRole[];
  /** 가상 IAM에서 존재 여부를 확인할 수 있는 AWS 관리형 정책 이름 */
  availableManagedPolicies?: string[];
  /**
   * 인스턴스가 실제로 응답하는 경로들.
   * 헬스체크 통과 여부를 "정해두는" 대신 여기서 계산한다.
   */
  servedPaths?: Record<string, string[]>;
}

// ---------- 전체 상태 ----------

export interface SystemState {
  hostname: string;
  /** 시뮬레이션 시각(epoch ms). 로그 타임스탬프와 uptime 표시에 쓴다. */
  clock: number;
  /** 터미널에 로그인한 사용자. sudo를 쓰면 그 명령만 root로 실행된다. */
  user: string;
  cwd: string;

  fs: DirNode; // 루트 디렉터리
  disks: Disk[];
  services: Service[];
  processes: Process[];
  journal: LogEntry[];
  memory: {
    totalKB: number;
    /** 커널/버퍼 등 프로세스로 표현하지 않은 기본 사용량 */
    reservedKB: number;
  };
  network: Network;
  /** 이 서버가 가진 TLS 인증서들 */
  certificates: Certificate[];
  /** DB 시나리오에서만 쓴다 */
  database?: Database;
  /** AWS 시나리오에서만 쓴다 */
  aws?: AwsState;
  /** Kubernetes 실습에만 있는 가상 클러스터 */
  kubernetes?: KubernetesState;
  /** Docker 실습에만 있는 가상 Docker 엔진 */
  docker?: DockerState;
}
