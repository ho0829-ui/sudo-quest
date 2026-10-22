/**
 * 엔딩 음악: 오펜바흐 「지옥의 갤럽」(캉캉, 1858) 주제를 8비트로 편곡해 브라우저가 직접 연주한다.
 * 작곡가가 1880년에 세상을 떠나 한국 보호기간(사후 70년)이 끝난 퍼블릭 도메인이고, 녹음 파일이 아니라
 * 코드가 소리를 만들어 연주·음반 권리 문제도 없다. 라이브러리 없이 Web Audio만 쓴다.
 *
 * 악보는 16분음표 단위로 적는다(2/4박자, 한 마디 = 8칸). 주선율(사각파)·베이스(삼각파)·하이햇(잡음)의 세 성부.
 */
import { clampVolume, loadVolume } from "./musicPrefs";

export type Voice = "lead" | "bass" | "hat";
export interface NoteEvent { at: number; length: number; freq: number; voice: Voice }

const SIXTEENTH = 0.085; // 초. 빠른 갤럽 템포
const BAR = 8;

type Bar = [note: string, length: number][];
const A1: Bar = [["G4", 8]];
const A2: Bar = [["A4", 2], ["C5", 2], ["B4", 2], ["A4", 2]];
const A3: Bar = [["D5", 2], ["D5", 2], ["D5", 1], ["E5", 1], ["B4", 1], ["C5", 1]];
const A4: Bar = [["A4", 2], ["A4", 2], ["A4", 1], ["C5", 1], ["B4", 1], ["A4", 1]];
const RUN: Bar = [["G4", 1], ["G5", 1], ["F#5", 1], ["E5", 1], ["D5", 1], ["C5", 1], ["B4", 1], ["A4", 1]];
const END: Bar = [["G4", 2], ["D4", 2], ["G4", 2], ["R", 2]];

/** 한 바퀴(10마디)의 주선율과 마디별 화음(베이스 근음·5음). */
export const MELODY: Bar[] = [A1, A2, A3, A4, RUN, A1, A2, A3, A4, END];
const CHORDS: [root: string, fifth: string][] = [
  ["G2", "D3"], ["D2", "A2"], ["G2", "D3"], ["D2", "A2"], ["G2", "D3"],
  ["G2", "D3"], ["D2", "A2"], ["G2", "D3"], ["D2", "A2"], ["G2", "D3"],
];
export const LOOP_SIXTEENTHS = MELODY.length * BAR;

const SEMITONE: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

/** "A4" → 440Hz, "F#5", "Bb3" 같은 이름. 쉼표 "R"은 0. */
export function noteFrequency(name: string): number {
  if (name === "R") return 0;
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new Error(`bad note ${name}`);
  const [, letter, accidental, octave] = match;
  const semis = SEMITONE[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0) + (Number(octave) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/** 한 바퀴의 모든 음. at·length는 16분음표 칸. */
export function songEvents(): NoteEvent[] {
  const events: NoteEvent[] = [];
  MELODY.forEach((bar, b) => {
    let at = b * BAR;
    for (const [note, length] of bar) {
      if (note !== "R") events.push({ at, length, freq: noteFrequency(note), voice: "lead" });
      at += length;
    }
    // 쿵-짝: 8분음표마다 근음·5음을 번갈아, 짝마다 하이햇
    const [root, fifth] = CHORDS[b];
    for (let k = 0; k < 4; k++) {
      events.push({ at: b * BAR + k * 2, length: 1.6, freq: noteFrequency(k % 2 ? fifth : root), voice: "bass" });
      if (k % 2) events.push({ at: b * BAR + k * 2, length: 0.5, freq: 0, voice: "hat" });
    }
  });
  return events.sort((a, b) => a.at - b.at);
}

// 선택 저장은 musicPrefs.ts. 예전 import 경로도 그대로 쓸 수 있게 다시 내보낸다.
export { loadMusicOn, saveMusicOn } from "./musicPrefs";

/** 볼륨 1(최대)일 때의 전체 음량. 사각파는 귀에 세게 들려 최대도 낮게 둔다. */
const MAX_GAIN = 0.12;
/** 시작할 때 0에서 서서히 키우는 시간(초). 소리가 갑자기 튀어나오지 않게 한다. */
export const FADE_IN = 2.5;

type AudioCtor = typeof AudioContext;
function audioContextClass(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}
export const audioSupported = () => audioContextClass() !== null;

/**
 * 반복 연주기. 0.2초 앞까지 미리 예약하는 방식이라 타이머가 조금 늦어도 박자가 흔들리지 않는다.
 * 브라우저는 사용자의 클릭·키 입력 전에는 소리를 막는다(AudioContext가 suspended로 시작).
 * 그래서 저절로 열린 피날레에서는 "기다리는 중"으로 두었다가 화면을 처음 누르거나 키를 누르는 순간 이어서 튼다.
 */
class ChipMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer = 0;
  private events = songEvents();
  private next = 0;
  private loopStart = 0;
  private noise: AudioBuffer | null = null;
  private unlock: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private volume = loadVolume();

  /** 0~1. 재생 중이면 0.1초에 걸쳐 부드럽게 바꾼다. */
  setVolume(value: number) {
    this.volume = clampVolume(value);
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume * MAX_GAIN, this.ctx.currentTime, 0.1);
  }
  get currentVolume() { return this.volume; }

  get playing() { return this.ctx !== null; }
  /** 켜 두었지만 브라우저가 아직 소리를 막고 있다(사용자 입력 기다리는 중). */
  get waiting() { return this.ctx?.state === "suspended"; }

  /** 재생·대기 상태가 바뀔 때 알림(버튼 문구를 맞추려고). 해제 함수를 돌려준다. */
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach(fn => fn()); }

  start() {
    const Ctor = audioContextClass();
    if (!Ctor || this.ctx) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.volume * MAX_GAIN, ctx.currentTime + FADE_IN);
    this.master.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.next = 0;
    this.loopStart = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 50);
    this.schedule();
    ctx.onstatechange = () => this.notify();
    if (ctx.state === "suspended") {
      const resume = () => { void ctx.resume(); this.unlock?.(); };
      const events = ["pointerdown", "keydown", "touchend"] as const;
      events.forEach(e => document.addEventListener(e, resume, { capture: true }));
      this.unlock = () => { events.forEach(e => document.removeEventListener(e, resume, { capture: true })); this.unlock = null; };
    }
    this.notify();
  }

  stop() {
    window.clearInterval(this.timer);
    this.unlock?.();
    const ctx = this.ctx;
    this.ctx = null;
    this.notify();
    if (!ctx || !this.master) return;
    // 뚝 끊기지 않게 짧게 줄인 뒤 닫는다.
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    window.setTimeout(() => { void ctx.close(); }, 300);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (true) {
      const event = this.events[this.next];
      const when = this.loopStart + event.at * SIXTEENTH;
      if (when > ctx.currentTime + 0.2) break;
      this.play(event, when);
      this.next++;
      if (this.next >= this.events.length) { this.next = 0; this.loopStart += LOOP_SIXTEENTHS * SIXTEENTH; }
    }
  }

  private play(event: NoteEvent, when: number) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const length = event.length * SIXTEENTH;
    const peak = event.voice === "lead" ? 0.5 : event.voice === "bass" ? 0.8 : 0.25;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.005);
    gain.gain.setTargetAtTime(0, when + length * 0.75, 0.02);
    gain.connect(this.master!);
    if (event.voice === "hat") {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 7000;
      source.buffer = this.noise;
      source.connect(filter).connect(gain);
      source.start(when);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = event.voice === "lead" ? "square" : "triangle";
    osc.frequency.value = event.freq;
    osc.connect(gain);
    osc.start(when);
    osc.stop(when + length + 0.1);
  }
}

/** 피날레와 엔딩 크레딧이 같은 연주기를 쓴다(피날레에서 켠 음악이 크레딧으로 이어진다). */
export const music = new ChipMusic();
