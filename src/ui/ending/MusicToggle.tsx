import { useEffect, useState } from "react";
import { audioSupported, loadMusicOn, music, saveMusicOn } from "./music";

/**
 * 소리 끄기/켜기 버튼. 기본은 소리 켬이고, 끄면 이 브라우저에 기억해 다음에 피날레·크레딧에 들어와도 조용하다.
 * 처음 그릴 때 저장된 선택이 "켬"이면 바로 튼다. 저절로 열린 화면이라 브라우저가 막고 있으면
 * "화면을 누르면 음악이 나와요"를 보여 주고, 첫 클릭·키 입력에 이어서 튼다(music.ts).
 */
export function MusicToggle() {
  const [muted, setMuted] = useState(() => !loadMusicOn());
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
  </>;
}
