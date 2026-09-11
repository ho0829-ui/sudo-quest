/**
 * 가상 시스템의 상태 모델.
 *
 * 핵심 원칙: 명령어 출력은 여기에 저장하지 않는다.
 * `df -h`의 사용량 같은 값은 저장된 값이 아니라 derived.ts에서 "계산"한다.
 * 그래야 플레이어가 파일을 지우면 df 결과가 저절로 바뀐다.
 */

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
}
