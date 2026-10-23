/**
 * 실습 터미널에서 지원하지 않지만 자주 찾는 명령. 터미널 출력은 실제 셸처럼 "command not found"로 두고,
 * 대신 무엇을 쓰면 같은 정보를 볼 수 있는지는 터미널 아래 명령어 안내(CommandGuide)에서 알려 준다.
 * 새 항목은 여기에 한 줄씩 더한다. instead의 명령이 그 실습에서 쓸 수 없으면 화면에서 자동으로 빠진다.
 */
export interface Alternative {
  /** 이 실습에서 대신 칠 명령(예시). 첫 단어가 그 실습의 허용 명령이어야 보인다. */
  command: string;
  why: string;
}

export interface UnsupportedCommand {
  names: string[];
  /** 실무에서 이 명령을 무엇에 쓰나 */
  purpose: string;
  instead: Alternative[];
  /** 대안이 없거나 덧붙일 말 */
  note?: string;
}

export const UNSUPPORTED_COMMANDS: UnsupportedCommand[] = [
  { names: ["netstat"], purpose: "열린 포트와 연결을 본다(오래된 도구라 요즘 리눅스는 ss를 쓴다).",
    instead: [{ command: "ss -tlnp", why: "듣고 있는 TCP 포트와 그 포트를 잡은 프로세스" }] },
  { names: ["ifconfig", "ip"], purpose: "네트워크 인터페이스·IP 주소·라우팅을 본다.",
    instead: [{ command: "ss -tlnp", why: "어느 주소·포트에서 듣고 있는지" }, { command: "dig <도메인>", why: "이름이 어떤 IP로 풀리는지" }, { command: "curl -v <주소>", why: "실제로 연결되는지" }],
    note: "이 실습은 인터페이스·라우팅 표를 모델링하지 않는다." },
  { names: ["top", "htop"], purpose: "CPU·메모리를 많이 쓰는 프로세스를 실시간으로 본다.",
    instead: [{ command: "ps aux", why: "지금 떠 있는 프로세스와 사용량(한 번 찍은 모습)" }, { command: "free -m", why: "전체 메모리 사용량" }] },
  { names: ["service"], purpose: "옛 방식(SysV init)으로 서비스를 시작·중지한다.",
    instead: [{ command: "systemctl status <서비스>", why: "상태와 최근 로그" }, { command: "sudo systemctl restart <서비스>", why: "다시 시작" }] },
  { names: ["vim", "vi", "nano", "emacs"], purpose: "파일을 화면에서 열어 고친다.",
    instead: [{ command: "sed -i 's/옛값/새값/' <파일>", why: "한 줄만 바꾸기" }, { command: "echo '내용' | sudo tee <파일>", why: "파일 내용을 새로 쓰기" }],
    note: "가상 터미널은 화면 편집기를 지원하지 않는다." },
  { names: ["less", "more"], purpose: "긴 출력을 한 화면씩 넘겨 본다.",
    instead: [{ command: "tail -n 50 <파일>", why: "끝부분만" }, { command: "head -n 50 <파일>", why: "앞부분만" }, { command: "grep <단어> <파일>", why: "필요한 줄만" }] },
  { names: ["apt", "apt-get", "yum", "dnf", "brew", "pip", "npm"], purpose: "패키지(프로그램)를 설치·갱신한다.",
    instead: [], note: "가상 환경이라 새로 설치할 수 없다. 모든 실습은 이미 있는 명령으로 풀 수 있게 만들었다." },
  { names: ["telnet", "nc"], purpose: "특정 포트로 연결이 되는지 직접 시험한다.",
    instead: [{ command: "curl -v http://<주소>:<포트>", why: "연결·응답을 단계별로" }, { command: "ss -tlnp", why: "서버 쪽에서 그 포트를 듣고 있는지" }] },
  { names: ["traceroute", "tracepath", "mtr"], purpose: "목적지까지 거치는 경로를 추적한다.",
    instead: [{ command: "ping <주소>", why: "닿는지" }, { command: "dig <도메인>", why: "이름 해석" }, { command: "curl -v <주소>", why: "어느 단계에서 막히는지" }] },
  { names: ["nslookup", "host"], purpose: "도메인 이름을 IP로 조회한다.",
    instead: [{ command: "dig <도메인>", why: "같은 조회를 더 자세히(응답 서버·시간까지)" }] },
  { names: ["find", "locate"], purpose: "조건에 맞는 파일을 찾는다.",
    instead: [{ command: "ls -la <디렉터리>", why: "폴더 안 목록" }, { command: "du -sh <디렉터리>/*", why: "어디가 큰지" }] },
  { names: ["cp", "mv", "touch"], purpose: "파일을 복사·이동하거나 빈 파일을 만든다.",
    instead: [{ command: "echo '내용' | sudo tee <파일>", why: "파일 만들기·덮어쓰기" }, { command: "mkdir -p <디렉터리>", why: "폴더 만들기" }] },
  { names: ["reboot", "shutdown"], purpose: "서버 전체를 다시 시작하거나 끈다.",
    instead: [{ command: "sudo systemctl restart <서비스>", why: "문제 있는 서비스만 다시 시작" }],
    note: "실무에서도 마지막 수단이다. 원인을 모른 채 재시작하면 로그·상태 같은 단서가 사라진다." },
  { names: ["man", "info"], purpose: "명령 설명서를 본다.",
    instead: [{ command: "help", why: "이 실습에서 쓸 수 있는 명령과 사용법" }] },
  { names: ["docker-compose"], purpose: "여러 컨테이너를 설정 파일로 함께 띄운다.",
    instead: [{ command: "docker ps -a", why: "컨테이너 목록" }, { command: "docker logs <컨테이너>", why: "컨테이너 로그" }] },
];

const BY_NAME = new Map(UNSUPPORTED_COMMANDS.flatMap(entry => entry.names.map(name => [name, entry] as const)));

export function unsupportedEntry(name: string): UnsupportedCommand | undefined {
  return BY_NAME.get(name);
}

/** 이 실습에서 실제로 칠 수 있는 대안만 남긴다(첫 단어가 허용 명령인 것). sudo는 건너뛰고 본다. */
export function usableAlternatives(entry: UnsupportedCommand, available: string[]): Alternative[] {
  return entry.instead.filter(alt => {
    const words = alt.command.split(/\s+/);
    const name = words[0] === "sudo" ? words[1] : words[0];
    return available.includes(name);
  });
}

/** 마지막으로 친 명령이 "command not found"였다면 그 명령 이름. 파이프 중 하나만 없어도 그 이름을 돌려준다. */
export function lastUnknownCommand(lines: { input: string; stderr: string; exitCode: number }[]): string | null {
  const last = [...lines].reverse().find(line => line.input.trim());
  if (!last) return null;
  const match = /(?:^|\n)(?:bash|sudo): ([^:\s]+): command not found/.exec(last.stderr);
  return match ? match[1] : null;
}
