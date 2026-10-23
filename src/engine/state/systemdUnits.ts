/**
 * systemd unit 파일과 drop-in(NAME.service.d/*.conf)을 읽는다. 파일은 가상 파일시스템에 그대로 있다.
 * systemd는 daemon-reload 때만 파일을 다시 읽는다. 그래서 파일을 고치고 reload 없이 restart하면 옛 설정이 그대로 쓰인다.
 */
import { findNode, isDir } from "./fs";
import type { Service, SystemState } from "./types";

export const dropInDir = (service: Service) => `/etc/systemd/system/${service.name}.service.d`;

/** 적용 순서대로(본 파일 → drop-in 이름순) 경로와 내용. */
export function unitFiles(state: SystemState, service: Service): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const main = findNode(state.fs, service.unitPath);
  if (main?.kind === "file") files.push({ path: service.unitPath, content: main.content });
  const dir = findNode(state.fs, dropInDir(service));
  if (dir && isDir(dir)) {
    for (const child of [...dir.children].sort((a, b) => a.name.localeCompare(b.name))) {
      if (child.kind === "file" && child.name.endsWith(".conf")) files.push({ path: `${dropInDir(service)}/${child.name}`, content: child.content });
    }
  }
  return files;
}

const sourceOf = (state: SystemState, service: Service) => unitFiles(state, service).map(f => `${f.path}\n${f.content}`).join("\n");

/** LimitNOFILE=값 | soft:hard | infinity. [Service] 절 안의 마지막 값이 이긴다(drop-in이 본 파일을 덮는다). */
export function parseNofile(files: { content: string }[]): { soft: number; hard: number } | undefined {
  let result: { soft: number; hard: number } | undefined;
  const number = (text: string) => (text === "infinity" ? 1_048_576 : /^\d+$/.test(text) ? Number(text) : NaN);
  for (const { content } of files) {
    let section = "";
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      const header = /^\[(.+)\]$/.exec(line);
      if (header) { section = header[1]; continue; }
      const match = /^LimitNOFILE\s*=\s*(\S+)$/.exec(line);
      if (section !== "Service" || !match) continue;
      const [soft, hard = soft] = match[1].split(":").map(number);
      // 잘못된 값은 systemd처럼 무시한다(이전 값 유지).
      if (Number.isFinite(soft) && Number.isFinite(hard) && soft <= hard) result = { soft, hard };
    }
  }
  return result;
}

export function daemonReload(state: SystemState) {
  for (const service of state.services) {
    service.loaded = { nofile: parseNofile(unitFiles(state, service)), source: sourceOf(state, service) };
  }
}

/** 마지막 daemon-reload 뒤에 unit 파일이 바뀌었는가 */
export const needsReload = (state: SystemState, service: Service) => !!service.loaded && service.loaded.source !== sourceOf(state, service);

export const reloadWarning = (service: Service) =>
  `Warning: The unit file, source configuration file or drop-ins of ${service.name}.service changed on disk. Run 'systemctl daemon-reload' to reload units.`;
