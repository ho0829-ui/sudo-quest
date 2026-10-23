/** 진단 명령어: ping, dig, free, ps, dmesg, kill */
import { flagValue, hasFlag, positionals } from "../parser/parse";
import { memoryUsage } from "../state/derived";
import { humanKB, table } from "../state/format";
import { formatLogTime } from "../state/format";
import { configuredNameserver, resolveHost } from "../state/network";
import { fail, ok, type Command, type CommandContext } from "./types";

export const ping: Command = {
  name: "ping",
  summary: "대상까지 닿는지 확인한다 (-c 횟수)",
  usage: "ping [-c 횟수] <호스트>",
  run({ state, tokens }: CommandContext) {
    const count = Number(flagValue(tokens, "c", "count") ?? 4);
    const host = positionals(tokens, ["c", "count"])[0];
    if (!host) return fail(`ping: usage error: Destination address required`, 2);

    const resolved = resolveHost(state, host);
    if (!resolved.ip) {
      return fail(`ping: ${host}: ${resolved.message ?? "Name or service not known"}`, 2);
    }

    // ICMP는 포트 개념이 없다. 상대가 존재하기만 하면 응답한다고 본다.
    const reachable =
      resolved.ip === "127.0.0.1" ||
      state.network.interfaces.some((i) => i.addr === resolved.ip) ||
      state.network.world.some((h) => h.ip === resolved.ip);

    const header = `PING ${host} (${resolved.ip}) 56(84) bytes of data.`;
    if (!reachable) {
      return {
        stdout: [
          header,
          "",
          `--- ${host} ping statistics ---`,
          `${count} packets transmitted, 0 received, 100% packet loss, time ${count * 1000}ms`,
        ].join("\n"),
        stderr: "",
        exitCode: 1,
      };
    }

    const replies = Array.from({ length: count }, (_, i) => {
      const time = (11.4 + i * 0.3).toFixed(1);
      return `64 bytes from ${resolved.ip}: icmp_seq=${i + 1} ttl=54 time=${time} ms`;
    });
    return ok(
      [
        header,
        ...replies,
        "",
        `--- ${host} ping statistics ---`,
        `${count} packets transmitted, ${count} received, 0% packet loss, time ${count * 1000}ms`,
      ].join("\n"),
    );
  },
};

export const dig: Command = {
  name: "dig",
  summary: "DNS 이름 해석을 확인한다",
  usage: "dig <도메인>",
  run({ state, tokens }: CommandContext) {
    const host = positionals(tokens)[0];
    const nameserver = configuredNameserver(state) ?? "127.0.0.1";
    if (!host) {
      // 루트 질의도 설정된 DNS 서버가 실제로 응답해야 된다(resolveHost와 같은 규칙).
      const configured = configuredNameserver(state);
      const reachable = configured !== null && state.network.dnsServers.includes(configured);
      const root = ["; <<>> DiG 9.18.18-0ubuntu2 <<>>", ";; global options: +cmd"];
      if (!reachable) return { stdout: [...root, ";; connection timed out; no servers could be reached"].join("\n"), stderr: "", exitCode: 9 };
      return ok([...root, ";; Got answer:", ";; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 1024", "", ";; ANSWER SECTION:",
        ".\t\t\t518400\tIN\tNS\ta.root-servers.net.", "", `;; SERVER: ${nameserver}#53(${nameserver})`].join("\n"));
    }

    const resolved = resolveHost(state, host);

    const head = [`; <<>> DiG 9.18.18-0ubuntu2 <<>> ${host}`, ";; global options: +cmd"];

    // DNS 서버 자체에 닿지 못한 경우 (resolv.conf가 잘못된 전형적인 모습)
    if (resolved.stage === "dns" && resolved.message === "Temporary failure in name resolution") {
      return {
        stdout: [...head, ";; connection timed out; no servers could be reached"].join("\n"),
        stderr: "",
        exitCode: 9,
      };
    }

    if (!resolved.ip) {
      return ok(
        [
          ...head,
          ";; Got answer:",
          ";; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 41207",
          "",
          ";; QUESTION SECTION:",
          `;${host}.\t\t\tIN\tA`,
          "",
          `;; SERVER: ${nameserver}#53(${nameserver})`,
        ].join("\n"),
      );
    }

    return ok(
      [
        ...head,
        ";; Got answer:",
        ";; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 20411",
        "",
        ";; QUESTION SECTION:",
        `;${host}.\t\t\tIN\tA`,
        "",
        ";; ANSWER SECTION:",
        `${host}.\t\t60\tIN\tA\t${resolved.ip}`,
        "",
        ";; Query time: 4 msec",
        `;; SERVER: ${nameserver}#53(${nameserver})`,
      ].join("\n"),
    );
  },
};

export const free: Command = {
  name: "free",
  summary: "메모리 사용량을 본다 (-m MB 단위, -h 읽기 쉽게)",
  usage: "free [-m|-h]",
  run({ state, tokens }: CommandContext) {
    const human = hasFlag(tokens, "h", "human");
    const usage = memoryUsage(state);
    // -m 은 MB 단위. 아무 옵션이 없으면 실제 free 처럼 KB로 보여준다.
    const megabytes = hasFlag(tokens, "m");
    const fmt = (kb: number) =>
      human ? humanKB(kb) : megabytes ? String(Math.round(kb / 1024)) : String(Math.round(kb));

    // buff/cache는 시뮬레이션하지 않지만, 열 구성은 실제와 맞춘다
    const rows = [
      ["", "total", "used", "free", "shared", "buff/cache", "available"],
      [
        "Mem:",
        fmt(usage.totalKB),
        fmt(usage.usedKB),
        fmt(usage.freeKB),
        fmt(0),
        fmt(Math.min(usage.freeKB, 128 * 1024)),
        fmt(usage.freeKB),
      ],
      ["Swap:", fmt(0), fmt(0), fmt(0), "", "", ""],
    ];
    return ok(table(rows, ["left", "right", "right", "right", "right", "right", "right"]));
  },
};

export const ps: Command = {
  name: "ps",
  summary: "실행 중인 프로세스를 본다 (aux)",
  usage: "ps aux",
  run({ state }: CommandContext) {
    const total = state.memory.totalKB;
    const rows = [["USER", "PID", "%CPU", "%MEM", "RSS", "COMMAND"]];

    // 메모리를 많이 쓰는 순으로 정렬한다. 범인을 찾기 쉬우라고가 아니라,
    // 실무에서도 ps aux --sort=-%mem 으로 이렇게 본다.
    for (const proc of [...state.processes].sort((a, b) => b.memKB - a.memKB)) {
      rows.push([
        proc.user,
        String(proc.pid),
        proc.cpu.toFixed(1),
        ((proc.memKB / total) * 100).toFixed(1),
        String(proc.memKB),
        proc.command,
      ]);
    }
    return ok(table(rows, ["left", "right", "right", "right", "right", "left"]));
  },
};

export const dmesg: Command = {
  name: "dmesg",
  summary: "커널 메시지를 본다 (-T 사람이 읽는 시각)",
  usage: "dmesg [-T]",
  run({ state, tokens }: CommandContext) {
    const humanTime = hasFlag(tokens, "T");
    const entries = state.journal.filter((e) => e.tag === "kernel");
    if (entries.length === 0) return ok("");

    const start = state.journal[0]?.time ?? state.clock;
    return ok(
      entries
        .map((entry) => {
          const stamp = humanTime
            ? `[${formatLogTime(entry.time)}]`
            : `[${((entry.time - start) / 1000).toFixed(6).padStart(12)}]`;
          return `${stamp} ${entry.message}`;
        })
        .join("\n"),
    );
  },
};

export const kill: Command = {
  name: "kill",
  summary: "프로세스를 종료한다 (-9 강제)",
  usage: "kill [-9] <PID>",
  run({ state, tokens, user }: CommandContext) {
    const signals = tokens.filter(t => t.startsWith("-"));
    const signal = signals[0] ?? "-15";
    if (signals.length > 1 || !["-0", "-9", "-15", "-TERM", "-KILL", "-SIGTERM", "-SIGKILL"].includes(signal)) {
      return fail(`kill: ${signal.slice(1)}: invalid signal specification`);
    }
    const args = positionals(tokens);
    if (args.length !== 1) return fail("kill: usage: kill [-0|-9|-15] pid");
    const pid = Number(args[0]);
    if (!Number.isInteger(pid)) return fail(`kill: ${args[0] ?? ""}: arguments must be process IDs`, 1);

    const proc = state.processes.find((p) => p.pid === pid);
    if (!proc) return fail(`kill: (${pid}) - No such process`, 1);
    if (user !== "root" && proc.user !== user) {
      return fail(`kill: (${pid}) - Operation not permitted`, 1);
    }

    // signal 0은 존재 여부·권한 검사만 한다. 종료 신호로 취급하면 점검이 장애 조치가 되어 버린다.
    if (signal === "-0") return ok();

    state.processes = state.processes.filter((p) => p.pid !== pid);
    // systemd가 관리하는 프로세스를 죽이면 서비스도 죽은 것으로 표시된다
    const service = state.services.find((s) => s.name === proc.service);
    if (service) {
      service.state = "failed";
      service.mainPid = undefined;
      service.since = state.clock;
      service.lastExitReason = "killed by signal";
    }
    return ok();
  },
};
