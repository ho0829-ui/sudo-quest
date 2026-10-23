/**
 * README 시연 캡처: 헤드리스 Chrome으로 앱을 실제로 조작하며 장면마다 캡처한다.
 *   node tools/demo/capture.mjs [main|tutorial|coach|stills ...]   (기본: 전부)
 * 필요: 개발 서버(127.0.0.1:5173). coach·지식·카페 장면은 API(8000)도 켜 두어야 한다(코치는 유료 호출 1~2회).
 * 결과: GIF 프레임은 tmp/demo/<이름>/(+ manifest.json), 스틸 사진은 docs/assets/readme/. GIF 조립은 make_gif.py.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { open, run } from "./page.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;

class Recorder {
  constructor(page, name) {
    this.page = page; this.dir = join(ROOT, "tmp/demo", name); this.frames = [];
    rmSync(this.dir, { recursive: true, force: true }); mkdirSync(this.dir, { recursive: true });
  }
  async frame(label, ms) {
    const file = `${String(this.frames.length).padStart(3, "0")}-${label}.png`;
    writeFileSync(join(this.dir, file), await this.page.screenshot());
    this.frames.push({ file, ms });
  }
  /** 사람이 치듯 몇 번에 나눠 입력하고, 실행 결과를 ms 동안 보여 준다. */
  async type(command, ms) {
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const part = command.slice(0, Math.ceil(command.length * i / steps));
      await run(this.page, `__d.setValue(__d.input(), ${JSON.stringify(part)}); await __d.wait(60); return true;`);
      await this.frame("typing", 110);
    }
    await run(this.page, `__d.enter(); await __d.wait(500); return true;`);
    await this.frame("output", ms);
  }
  save() { writeFileSync(join(this.dir, "manifest.json"), JSON.stringify(this.frames, null, 2)); }
}

async function main() {
  const page = await open("#/");
  const rec = new Recorder(page, "main");
  await rec.frame("home", 2400);
  await run(page, `document.querySelector(".hero-actions .primary").click(); await __d.wait(1200); return true;`);
  await rec.frame("briefing", 2000);
  await run(page, `await __d.click("조사 시작"); await __d.until(() => document.querySelector("dialog[open]")); await __d.wait(1800); return true;`);
  await rec.frame("quest", 2000);
  await run(page, `await __d.accept(); return true;`);
  await rec.frame("terminal", 900);
  await rec.type("systemctl status nginx", 2600);
  await rec.type("journalctl -u nginx -n 20", 2600);
  await rec.type("df -h", 1800);
  await rec.type("du -sh /var/log/*", 2200);
  await run(page, `await __d.click("원인 제출하기"); await __d.wait(600); return true;`);
  await rec.frame("cause", 1800);
  await run(page, `__d.pick("메모리가 부족해"); await __d.wait(900); return true;`);
  await rec.frame("wrong", 3000);
  await run(page, `__d.pick("애플리케이션 로그가"); await __d.wait(900); return true;`);
  await rec.frame("solved", 1200);
  await rec.type("sudo rm /var/log/app/app.log", 1200);
  await rec.type("sudo systemctl restart nginx", 900);
  await run(page, `await __d.until(() => location.hash.endsWith("/report")); await __d.wait(1500); scrollTo(0, 0); return true;`);
  await rec.frame("report", 3000);
  await run(page, `document.querySelector(".report-postmortem").scrollIntoView(); await __d.wait(500); return true;`);
  await rec.frame("postmortem", 3200);
  rec.save(); await page.close();
}

async function tutorial() {
  const page = await open("#/");
  const rec = new Recorder(page, "tutorial");
  await run(page, `document.querySelector(".tutorial-button").click(); await __d.wait(1500); return true;`);
  await rec.frame("ticket", 2600);
  await run(page, `__d.btn("다음", document.querySelector(".tutorial-bubble")).click(); await __d.click("조사 시작"); await __d.accept(); await __d.wait(800); return true;`);
  await rec.frame("help-step", 2200);
  await rec.type("help", 2000);
  await rec.type("systemctl status nginx", 2600);
  await rec.type("journalctl -u nginx", 2600);
  await run(page, `await __d.wait(600); return true;`);
  await rec.frame("tools-step", 2600);
  await run(page, `__d.btn("다음", document.querySelector(".tutorial-bubble")).click(); await __d.wait(900); return true;`);
  await rec.frame("cause-step", 2600);
  rec.save(); await page.close();
}

async function coach() {
  const page = await open("#/mission/1");
  const rec = new Recorder(page, "coach");
  await run(page, `await __d.click("조사 시작"); await __d.accept(); return true;`);
  for (const command of ["systemctl status nginx", "journalctl -u nginx -n 20", "df -h"]) {
    await run(page, `__d.setValue(__d.input(), ${JSON.stringify(command)}); __d.enter(); await __d.wait(500); return true;`);
  }
  await rec.frame("investigated", 1600);
  await run(page, `__d.btn("AI 코치", document.querySelector(".sidebar-tabs")).click(); await __d.wait(500);
    const box = document.querySelector("textarea[aria-label='코치에게 할 질문']"); box.scrollIntoView({ block: "center" });
    __d.setValue(box, "로그의 No space left on device는 무슨 뜻이고, 다음에 무엇을 확인하면 될까요?"); await __d.wait(300); return true;`);
  await rec.frame("question", 2200);
  await run(page, `__d.btn("묻기").click(); await __d.wait(1500); return true;`);
  await rec.frame("thinking", 1400);
  await run(page, `await __d.until(() => document.querySelector(".coach-answer"), 120000); await __d.wait(600);
    document.querySelector(".coach-turn").scrollIntoView({ block: "start" }); await __d.wait(400); return true;`);
  await rec.frame("answer", 4200);
  await run(page, `document.querySelector(".coach-answer").scrollIntoView({ block: "end" }); await __d.wait(400); return true;`);
  await rec.frame("answer-more", 4200);
  rec.save(); await page.close();
}

const jobs = { main, tutorial, coach, stills: () => import("./stills.mjs").then(m => m.stills()) };
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(jobs)) {
  console.log("capture", name);
  await jobs[name]();
}
