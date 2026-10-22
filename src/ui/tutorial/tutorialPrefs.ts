/**
 * 튜토리얼을 끝냈거나 건너뛰었는지. 이 브라우저에만 기억하는 표시라 저장이 막혀도 "안 봤음"으로 동작한다.
 * 로그인(19번 계획)이 생기면 계정의 tutorial_done_at으로 옮기고, 첫 로그인 때 자동으로 띄운다.
 */
const KEY = "incident-game/tutorial-done";

export function loadTutorialDone(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function saveTutorialDone() {
  try { localStorage.setItem(KEY, "1"); } catch { /* 저장이 막혀도 튜토리얼은 그대로 끝난다 */ }
}
