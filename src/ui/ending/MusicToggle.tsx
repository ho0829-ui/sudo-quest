import { useEffect, useState } from "react";
import { audioSupported, music, saveMusicOn } from "./music";

/**
 * 음악 켜기/끄기 버튼. 누를 때마다 이 브라우저에 선택을 기억한다.
 * autoStart면 처음 그릴 때(사용자가 버튼을 눌러 이 화면을 연 직후) 저장된 선택대로 바로 켠다.
 */
export function MusicToggle({ autoStart = false }: { autoStart?: boolean }) {
  const [on, setOn] = useState(music.playing);
  const supported = audioSupported();

  useEffect(() => {
    if (autoStart && supported && !music.playing) { music.start(); setOn(true); }
  }, []);

  if (!supported) return <button type="button" className="ending-button" disabled>이 브라우저는 소리를 낼 수 없어요</button>;
  return <button type="button" className="ending-button" aria-pressed={on}
    onClick={() => {
      if (on) music.stop(); else music.start();
      saveMusicOn(!on);
      setOn(!on);
    }}>{on ? "🔊 음악 끄기" : "🔈 음악 켜기"}</button>;
}
