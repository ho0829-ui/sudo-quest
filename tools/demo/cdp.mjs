/**
 * 아주 작은 Chrome DevTools Protocol 클라이언트(README 시연 캡처용, 개발 도구).
 * 설치된 Chrome을 임시 프로필·헤드리스로 띄우고 Node 내장 WebSocket으로 조작한다 — 새 의존성이 없다.
 * 사용자의 Chrome 프로필·저장소는 건드리지 않는다(매번 빈 임시 프로필).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function launch({ width = 1280, height = 720, scale = 1, args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "sudo-quest-demo-"));
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
    `--window-size=${width},${height}`, ...args, "about:blank",
  ], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await wait(200);
    target = await fetch(`http://127.0.0.1:${PORT}/json`).then(r => r.json()).then(list => list.find(t => t.type === "page")).catch(() => undefined);
  }
  if (!target) throw new Error("Chrome에 연결하지 못했습니다");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: width < 600 });

  return {
    send,
    /** 페이지에서 식을 실행하고 값을 돌려받는다(await 가능). */
    async eval(expression) {
      const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
      return result.result.value;
    },
    async screenshot(format = "png") {
      const { data } = await send("Page.captureScreenshot", format === "jpeg" ? { format, quality: 88 } : { format });
      return Buffer.from(data, "base64");
    },
    async close() {
      socket.close();
      chrome.kill();
      await wait(300);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}
