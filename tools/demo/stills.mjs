/**
 * README 화면 둘러보기 사진(1280×720 JPEG) → docs/assets/readme/. capture.mjs stills로 실행한다.
 * 진행 기록이 필요한 장면(파티·엔딩)은 빈 임시 프로필의 저장소에 기록을 넣고 연다(사용자 브라우저와 무관).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { open, run } from "./page.mjs";

const OUT = new URL("../../docs/assets/readme/", import.meta.url).pathname;
const progress = filter => `const { scenarios } = await import("/src/scenarios/index.ts");
  return JSON.stringify(Object.fromEntries(scenarios.filter(s => ${filter}).map(s => [s.id, { cleared: true, bestScore: 920, clearedAt: Date.now() }])));`;

async function still(page, name) {
  writeFileSync(join(OUT, name + ".jpg"), await page.screenshot("jpeg"));
  console.log("still", name);
}

/** 기록을 계산하려면 앱 모듈이 필요해서, 한 번 열어 계산한 뒤 그 기록을 넣고 다시 연다. */
async function withProgress(filter, hash, extra = {}) {
  const probe = await open("#/");
  const value = await run(probe, progress(filter));
  await probe.close();
  return open(hash, { storage: { "incident-game/v1": value, ...extra } });
}

async function solveMissionOne(page) {
  await run(page, `await __d.click("조사 시작"); await __d.accept();
    for (const c of ["systemctl status nginx", "journalctl -u nginx -n 20", "df -h", "du -sh /var/log/*", "sudo rm /var/log/app/app.log", "sudo systemctl restart nginx"]) {
      __d.setValue(__d.input(), c); __d.enter(); await __d.wait(350);
    }
    await __d.click("원인 제출하기"); __d.pick("애플리케이션 로그가");
    await __d.until(() => location.hash.endsWith("/report")); await __d.wait(1500); scrollTo(0, 0); return true;`);
}

export async function stills() {
  mkdirSync(OUT, { recursive: true });
  let page = await withProgress(`s.category === "linux"`, "#/");
  await still(page, "01-campus");
  await page.close();

  // 실습 화면은 터미널과 힌트(용어 풀이)를 한 장에 담으려고 세로를 1000px로 찍는다.
  page = await open("#/mission/6", { height: 1000 });
  await still(page, "02-briefing");
  await run(page, `await __d.click("조사 시작"); await __d.accept();
    for (const c of ["tail -n 5 /var/log/app/shop-api.log", "dig api.payments.example.com"]) { __d.setValue(__d.input(), c); __d.enter(); await __d.wait(400); }
    __d.btn("조사 현황", document.querySelector(".sidebar-tabs")).click(); await __d.wait(300);
    __d.btn("힌트 열기").click(); await __d.wait(300); __d.btn("힌트 열기").click(); await __d.wait(400);
    document.querySelectorAll(".hint-glossary")[1].open = true;
    scrollTo(0, document.querySelector(".mission-hud").getBoundingClientRect().top + scrollY - 16); await __d.wait(500); return true;`);
  await still(page, "03-play-glossary");
  await page.close();

  page = await open("#/mission/1");
  await solveMissionOne(page);
  await still(page, "04-report");
  await page.close();

  page = await open("#/knowledge");
  await run(page, `[...document.querySelectorAll(".knowledge-items button")].find(b => b.textContent.includes("readiness probe와 서비스")).click(); await __d.wait(500);
    __d.setValue(document.querySelector("#knowledge-question"), "readiness probe가 실패하면 서비스로 가는 트래픽은 어떻게 되나요?"); await __d.wait(200);
    __d.btn("근거 찾아 질문하기").click();
    await __d.until(() => document.querySelector(".knowledge-turns .source-card") || document.querySelector(".knowledge-turns [role=alert]"), 90000); await __d.wait(800);
    [...document.querySelectorAll(".knowledge-turns article")].at(-1).scrollIntoView({ block: "start" }); scrollBy(0, -80); await __d.wait(400); return true;`);
  await still(page, "05-knowledge");
  await page.close();

  page = await open("#/community");
  await still(page, "06-cafe");
  await page.close();

  page = await withProgress("true", "#/", { "incident-game/music": "off" });
  await run(page, `await __d.until(() => document.querySelector(".finale")); await __d.wait(2500); return true;`);
  await still(page, "07-finale");
  await run(page, `__d.btn("🎬 엔딩 크레딧 보기").click(); await __d.wait(5000); return true;`);
  await still(page, "08-credits");
  await page.close();
}
