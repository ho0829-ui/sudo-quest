import type { DirNode, FileNode, FsNode, SystemState } from "./types";

/** "/var/log/../log/app.log" 같은 경로를 "/var/log/app.log"로 정리한다. */
export function normalizePath(cwd: string, path: string): string {
  const base = path.startsWith("/") ? "" : cwd;
  const segments = `${base}/${path}`.split("/");
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return "/" + out.join("/");
}

/** "/var/log/app.log" → { parent: "/var/log", name: "app.log" } */
export function splitLast(absPath: string): { parent: string; name: string } {
  const idx = absPath.lastIndexOf("/");
  return {
    parent: idx === 0 ? "/" : absPath.slice(0, idx),
    name: absPath.slice(idx + 1),
  };
}

export function isDir(node: FsNode): node is DirNode {
  return node.kind === "dir";
}

/** 절대 경로로 노드를 찾는다. 없으면 null. */
export function findNode(root: DirNode, absPath: string): FsNode | null {
  if (absPath === "/") return root;
  let current: FsNode = root;
  for (const seg of absPath.split("/").filter(Boolean)) {
    if (!isDir(current)) return null;
    const next: FsNode | undefined = current.children.find((c) => c.name === seg);
    if (!next) return null;
    current = next;
  }
  return current;
}

/** 상태와 상대 경로를 받아 노드를 찾는 편의 함수 */
export function lookup(state: SystemState, path: string): { abs: string; node: FsNode | null } {
  const abs = normalizePath(state.cwd, path);
  return { abs, node: findNode(state.fs, abs) };
}

/** 트리 전체를 순회한다. [절대경로, 노드] 쌍을 내놓는다. */
export function* walk(node: FsNode, path: string): Generator<[string, FsNode]> {
  yield [path, node];
  if (isDir(node)) {
    for (const child of node.children) {
      const childPath = path === "/" ? `/${child.name}` : `${path}/${child.name}`;
      yield* walk(child, childPath);
    }
  }
}

/** 중간 디렉터리를 만들면서 경로를 확보한다. (mkdir -p) */
export function ensureDir(root: DirNode, absPath: string, owner = "root"): DirNode {
  let current = root;
  for (const seg of absPath.split("/").filter(Boolean)) {
    const found = current.children.find((c) => c.name === seg);
    if (found && isDir(found)) {
      current = found;
      continue;
    }
    if (found) throw new Error(`${seg} 은(는) 디렉터리가 아닙니다`);
    const created: DirNode = {
      kind: "dir",
      name: seg,
      owner,
      group: owner,
      mode: 0o755,
      mtime: 0,
      children: [],
    };
    current.children.push(created);
    current = created;
  }
  return current;
}

export interface WriteFileOptions {
  sizeKB?: number;
  content?: string;
  owner?: string;
  group?: string;
  mode?: number;
  mtime?: number;
}

/** 파일을 만들거나 덮어쓴다. 없는 상위 디렉터리는 자동으로 만든다. */
export function writeFile(root: DirNode, absPath: string, options: WriteFileOptions = {}): FileNode {
  const { parent, name } = splitLast(absPath);
  const dir = ensureDir(root, parent, options.owner ?? "root");
  const content = options.content ?? "";
  const existing = dir.children.find((c) => c.name === name);

  const file: FileNode = {
    kind: "file",
    name,
    owner: options.owner ?? (existing?.owner ?? "root"),
    group: options.group ?? (existing?.group ?? "root"),
    mode: options.mode ?? (existing?.mode ?? 0o644),
    mtime: options.mtime ?? 0,
    // sizeKB를 안 주면 내용 길이로 계산한다. 최소 1KB (실제 파일시스템의 블록 단위처럼)
    sizeKB: options.sizeKB ?? Math.max(1, Math.ceil(content.length / 1024)),
    content,
  };

  if (existing) dir.children[dir.children.indexOf(existing)] = file;
  else dir.children.push(file);
  return file;
}

/** 노드를 지운다. 성공하면 true. */
export function removeNode(root: DirNode, absPath: string): boolean {
  const { parent, name } = splitLast(absPath);
  const dir = findNode(root, parent);
  if (!dir || !isDir(dir)) return false;
  const idx = dir.children.findIndex((c) => c.name === name);
  if (idx === -1) return false;
  dir.children.splice(idx, 1);
  return true;
}

// ---------- 권한 ----------

/**
 * 권한 검사. 실제 리눅스는 사용자/그룹/기타 3단계를 보지만,
 * 이 게임에는 그룹 개념이 거의 안 쓰이므로 소유자와 기타(other)만 본다.
 */
function permissionBits(node: FsNode, user: string): number {
  if (user === node.owner) return (node.mode >> 6) & 0o7;
  return node.mode & 0o7;
}

export function canRead(node: FsNode, user: string): boolean {
  if (user === "root") return true; // root는 퍼미션을 무시한다
  return (permissionBits(node, user) & 0o4) !== 0;
}

export function canWrite(node: FsNode, user: string): boolean {
  if (user === "root") return true;
  return (permissionBits(node, user) & 0o2) !== 0;
}

/** 0o644 → "-rw-r--r--" 처럼 ls -l 형식으로 만든다. */
export function formatMode(node: FsNode): string {
  const rwx = (bits: number) =>
    `${bits & 4 ? "r" : "-"}${bits & 2 ? "w" : "-"}${bits & 1 ? "x" : "-"}`;
  const type = node.link ? "l" : node.kind === "dir" ? "d" : "-";
  return type + rwx((node.mode >> 6) & 7) + rwx((node.mode >> 3) & 7) + rwx(node.mode & 7);
}
