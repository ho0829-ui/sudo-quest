import { withCommands } from "../engine/commands";
import { all, firewallAllows, serviceIsActive } from "../engine/judge";
import { logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/**
 * 방화벽에서 80 포트 규칙을 없앤다.
 * ufw의 기본 정책이 deny라서, 규칙이 사라지면 외부에서 접속할 수 없게 된다.
 */
const blockHttp: Fault = (state) => {
  state.network.firewall.rules = state.network.firewall.rules.filter((rule) => rule.port !== 80);
};

export const networkFirewall: Scenario = {
  id: "network-firewall",
  title: "밖에서는 사이트가 안 열린다는데, 서버는 멀쩡해요",
  category: "network",
  difficulty: 1,

  ticket: [
    "고객사에서 연락이 왔습니다.",
    "오늘 오전부터 shop.example.com 접속이 안 된다고 합니다. 계속 로딩만 되다가 끊긴다고 하네요.",
    "그런데 저희 팀에서 서버에 SSH로 들어가 보면 아무 문제가 없어 보입니다.",
    "nginx도 돌고 있고 서버도 살아 있는데 왜 밖에서는 안 되는 걸까요?",
  ].join("\n"),

  learningObjectives: [
    "서비스가 살아 있는 것과 외부에서 닿는 것은 다른 문제임을 안다",
    "서버 안에서 curl로 테스트해 문제 범위를 애플리케이션 밖으로 좁힌다",
    "ss로 바인딩을, ufw로 방화벽을 확인하는 순서를 익힌다",
  ],

  host: "ubuntu-web",
  commands: withCommands("curl", "ss", "ufw"),

  faults: [
    blockHttp,
    logLine("ufw", "[UFW BLOCK] IN=eth0 SRC=198.51.100.23 DST=10.0.1.10 PROTO=TCP DPT=80", {
      offsetMs: -1_500_000,
    }),
    logLine("ufw", "[UFW BLOCK] IN=eth0 SRC=198.51.100.77 DST=10.0.1.10 PROTO=TCP DPT=80", {
      offsetMs: -600_000,
    }),
    // 원인과 무관한 정상 로그
    logLine("sshd", "Accepted publickey for ubuntu from 10.0.1.55 port 51988 ssh2", {
      offsetMs: -300_000,
      pid: 2610,
    }),
  ],

  rootCause: {
    answerId: "firewall-blocked",
    choices: [
      {
        id: "firewall-blocked",
        label: "방화벽(ufw)에서 80 포트 허용 규칙이 사라져, 외부에서 오는 HTTP 접속이 차단되고 있다",
      },
      {
        id: "nginx-down",
        label: "nginx가 죽어 있어 웹 요청을 처리하지 못하고 있다",
        whyWrong:
          "systemctl status를 보면 nginx는 active (running) 상태이고, 서버 안에서 curl localhost를 하면 정상 응답이 옵니다.",
      },
      {
        id: "bind-localhost",
        label: "nginx가 127.0.0.1에만 바인딩되어 외부 요청을 받지 못한다",
        whyWrong:
          "ss -tlnp 결과를 보면 0.0.0.0:80 으로 listen 중입니다. 모든 주소에서 요청을 받는다는 뜻이라 바인딩 문제는 아닙니다.",
      },
      {
        id: "dns-wrong",
        label: "DNS 레코드가 잘못되어 다른 서버로 연결되고 있다",
        whyWrong:
          "이름 해석이 문제라면 접속이 '거부'되거나 '해석 실패'로 즉시 끝납니다. 계속 로딩되다 끊기는 건 패킷이 조용히 버려지고 있다는 신호입니다.",
      },
    ],
  },

  hints: [
    "서버 안에서는 멀쩡한데 밖에서만 안 된다면, 문제는 애플리케이션이 아니라 그 사이 어딘가에 있습니다. 요청이 서버까지 들어오기는 할까요?",
    "먼저 서버 안에서 `curl -I http://localhost` 로 nginx가 정말 응답하는지 확인하고, `ss -tlnp` 로 어떤 주소에 바인딩됐는지 보세요. 둘 다 정상이라면 그다음은 방화벽입니다.",
    "`sudo ufw status verbose` 를 보세요. 기본 정책이 deny인데 80 포트를 허용하는 규칙이 보이지 않습니다. journalctl에 UFW BLOCK 로그도 남아 있습니다.",
  ],

  // nginx는 처음부터 살아 있다. 방화벽만 열면 된다.
  resolution: all(firewallAllows(80), serviceIsActive("nginx")),

  solutionPath: [
    "systemctl status nginx",
    "curl -I http://localhost",
    "ss -tlnp",
    "sudo ufw status verbose",
    "journalctl -n 20",
    "sudo ufw allow 80/tcp",
    "sudo ufw status",
  ],

  postmortem: {
    whatHappened:
      "서버의 방화벽(ufw)에서 80/tcp 허용 규칙이 사라졌습니다. ufw의 기본 인바운드 정책은 deny이기 때문에, 규칙이 없어지는 순간 외부에서 오는 모든 HTTP 요청이 조용히 버려졌습니다. nginx는 정상적으로 돌고 있었고 서버 안에서의 요청은 방화벽을 거치지 않기 때문에, 서버에 들어가 확인한 사람 눈에는 아무 문제가 없어 보였습니다.",
    whyItHappened:
      "방화벽 규칙이 수동으로 관리되고 있었고, 누가 언제 무엇을 바꿨는지 기록이 남지 않았습니다. 규칙을 정리하다가 필요한 규칙까지 함께 지워졌을 가능성이 높습니다.",
    howToFix:
      "`sudo ufw allow 80/tcp` 로 규칙을 복구합니다. HTTPS도 함께 쓴다면 443도 확인해야 합니다. 조치 후에는 반드시 외부에서 실제로 접속되는지 확인합니다.",
    howToPrevent: [
      "1) 방화벽 규칙을 코드로 관리합니다 (Ansible, Terraform). 손으로 고치지 않으면 손으로 지울 일도 없습니다.",
      "2) 외형 모니터링(external synthetic check)을 둡니다. 서버 안에서 도는 헬스체크는 이런 장애를 절대 못 잡습니다. 반드시 바깥에서 찔러봐야 합니다.",
      "3) 변경 이력을 남깁니다. 방화벽 변경은 승인과 기록이 필요한 작업으로 다룹니다.",
    ].join("\n"),
    realWorldNote:
      "'연결 거부(Connection refused)'와 '응답 없음(timeout)'은 다른 신호입니다. 거부는 서버까지 갔는데 그 포트에 아무도 없다는 뜻이고, 타임아웃은 패킷이 중간에서 조용히 버려졌다는 뜻입니다. 방화벽 문제는 대부분 타임아웃으로 나타납니다.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "Ubuntu Server 문서 — Firewall(ufw)", url: "https://ubuntu.com/server/docs/how-to/security/firewalls/" },
    { kind: "survey", title: "Uptime Institute, Annual Outage Analysis 2024 (네트워크·연결성이 IT 서비스 장애 1위)", url: "https://uptimeinstitute.com/resources/research-and-reports/annual-outage-analysis-2024" },
  ],
};
