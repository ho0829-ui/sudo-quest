import { useEffect, useState } from "react";
import { audioSupported, music } from "./music";
import { loadMusicOn, saveMusicOn, saveVolume } from "./musicPrefs";

/**
 * 소리 끄기/켜기 버튼 + 볼륨 막대. 기본은 소리 켬·작은 볼륨(35%)이고 2.5초에 걸쳐 서서히 커진다.
 * 끄거나 볼륨을 바꾸면 이 브라우저에 기억해 다음 피날레·크레딧에도 그대로 쓴다.
 * 저절로 열린 화면이라 브라우저가 막고 있으면 "화면을 누르면 음악이 나와요"를 보여 주고, 첫 클릭·키 입력에 재생한다(music.ts).
 */
export function MusicToggle() {
  const [muted, setMuted] = useState(() => !loadMusicOn());
  const [volume, setVolume] = useState(() => Math.round(music.currentVolume * 100));
  const [, rerender] = useState(0);
  const supported = audioSupported();

  useEffect(() => {
    const off = music.subscribe(() => rerender(n => n + 1));
    if (supported && !muted && !music.playing) music.start();
    return off;
  }, []);

  if (!supported) return <button type="button" className="ending-button" disabled>이 브라우저는 소리를 낼 수 없어요</button>;
  return <>
    {!muted && music.waiting && <span className="music-waiting" role="status">♪ 화면을 누르면 음악이 나와요</span>}
    <button type="button" className="ending-button" onClick={() => {
      if (muted) music.start(); else music.stop();
      saveMusicOn(muted);
      setMuted(!muted);
    }}>{muted ? "🔇 소리 켜기" : "🔊 소리 끄기"}</button>
    <label className={`music-volume${muted ? " is-muted" : ""}`}>
      <span aria-hidden="true">{volume === 0 ? "🔈" : volume < 50 ? "🔉" : "🔊"}</span>
      <input type="range" min={0} max={100} step={5} value={volume} aria-label="음악 볼륨" aria-valuetext={`${volume}%`} disabled={muted}
        onChange={e => {
          const next = Number(e.target.value);
          setVolume(next);
          music.setVolume(next / 100);
          saveVolume(next / 100);
        }} />
      <span className="music-volume-value">{volume}%</span>
    </label>
  </>;
}
