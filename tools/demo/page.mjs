/**
 * 시연 캡처에서 페이지 안에 심는 도우미. 사람이 하는 것처럼 버튼을 누르고 터미널에 명령을 친다.
 * 게임 상태는 실제 화면 조작으로만 바뀐다(내부 함수를 직접 부르지 않는다).
 */
import { launch } from "./cdp.mjs";

const BASE = "http://127.0.0.1:5173/";

export const HELPERS = `
window.__d = {
  wait: ms => new Promise(r => setTimeout(r, ms)),
  async until(fn, ms = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await __d.wait(150); }
    throw new Error("시간 안에 나타나지 않음");
  },
  btn: (text, root = document) => [...root.querySelectorAll("button")].find(b => b.textContent.trim().startsWith(text)),
  async click(text) { const b = await __d.until(() => __d.btn(text)); b.click(); await __d.wait(400); },
  input: () => document.querySelector(".terminal-input-row input"),
  setValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  },
  enter() { __d.input().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); },
  /** 브리핑 대화(퀘스트)를 넘겨 터미널까지 간다. */
  async accept() {
    let b = await __d.until(() => __d.btn("상황 확인했어요") || __d.btn("퀘스트 수락"));
    if (b.textContent.includes("상황")) { b.click(); b = await __d.until(() => __d.btn("퀘스트 수락")); }
    b.click();
    await __d.until(() => __d.input());
    await __d.wait(600);
  },
  pick(text) { [...document.querySelectorAll("dialog[open] label, dialog[open] button")].find(e => e.textContent.includes(text)).click(); },
};
true`;

/** 페이지에 도우미를 심고(이미 있으면 그대로) 식을 실행한다. */
export async function run(page, body) {
  await page.eval(HELPERS);
  return page.eval(`(async () => { ${body} })()`);
}

/** 빈 임시 프로필로 앱을 연다. storage를 주면 먼저 저장소에 넣고(진행 기록 등) 주소로 간다. */
export async function open(hash, { storage, height = 720 } = {}) {
  const page = await launch({ width: 1280, height });
  await page.send("Page.navigate", { url: BASE });
  await new Promise(r => setTimeout(r, 1500));
  if (storage) {
    await page.eval(`(() => { ${Object.entries(storage).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join("")} return true; })()`);
  }
  // 해시만 바뀌면 문서를 다시 읽지 않으므로, 넣어 둔 저장소를 앱이 읽도록 새로고침한다.
  await page.eval(`location.hash = ${JSON.stringify(hash)}; true`);
  await new Promise(r => setTimeout(r, 300));
  await page.send("Page.reload");
  // 캠퍼스 그림·AI 코치 상태 배지가 다 그려질 때까지 기다린다(헤드리스에서 약 5초).
  await new Promise(r => setTimeout(r, 5500));
  return page;
}
