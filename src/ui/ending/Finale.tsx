/**
 * 올클리어 피날레: 모든 실습을 해결하면 홈에서 한 번 저절로 열리는 축하 화면(관제실 버튼으로 다시 보기).
 * 불꽃놀이 + ALL CLEAR + 축하 메시지 + 기록 요약 + 엔딩 크레딧으로 가는 버튼.
 * 음악은 기본으로 켜진다("소리 끄기"로 끄면 기억). 저절로 열린 화면이라 브라우저가 첫 클릭·키 입력까지 소리를 막으므로
 * 그때까지는 "화면을 누르면 음악이 나와요"를 보여 준다.
 */
import type { CSSProperties } from "react";
import { operatorRank } from "../rank";
import { Fireworks } from "./Fireworks";
import { music } from "./music";
import { MusicToggle } from "./MusicToggle";
import { useDialog } from "./useDialog";

interface FinaleProps {
  cleared: number;
  total: number;
  /** 최고 점수 합(레일의 XP와 같은 값) */
  xp: number;
  motion: boolean;
  onCredits: () => void;
  onClose: () => void;
}

const TITLE = "ALL CLEAR";
const LETTER_COLORS = ["#ffd447", "#ff5fa2", "#5cc8ff", "#7dff9b", "#b48bff", "#ff8a3d"];

export function Finale({ cleared, total, xp, motion, onCredits, onClose }: FinaleProps) {
  // 캠퍼스로 돌아가면 음악도 끈다. 크레딧으로 갈 때는 이어서 튼다.
  const close = () => { music.stop(); onClose(); };
  const ref = useDialog<HTMLDivElement>(close);
  const rank = operatorRank(cleared, total);
  return <div className={`finale${motion ? "" : " is-still"}`} role="dialog" aria-modal="true" aria-labelledby="finale-title" ref={ref}>
    <Fireworks motion={motion} />
    <div className="finale-card">
      <span className="finale-kicker">MISSION COMPLETE · {cleared}/{total}</span>
      <h1 id="finale-title" className="finale-title" aria-label={TITLE}>
        {[...TITLE].map((ch, i) => <span key={i} aria-hidden="true" style={{ "--i": i, "--c": LETTER_COLORS[i % LETTER_COLORS.length] } as CSSProperties}>{ch === " " ? " " : ch}</span>)}
      </h1>
      <p className="finale-lead">모든 장애를 해결했어요! 🎉</p>
      <p className="finale-text">{total}개의 장애를 증상부터 재발 방지까지 직접 복구했습니다.<br />오늘 밤 서버는 조용할 거예요. 수고 많으셨어요, 운영자님.</p>
      <dl className="finale-stats">
        <div><dt>해결한 장애</dt><dd>{cleared}<small> / {total}</small></dd></div>
        <div><dt>XP</dt><dd>{xp.toLocaleString("ko-KR")}</dd></div>
        <div><dt>등급</dt><dd>Lv{rank.level} {rank.title}</dd></div>
      </dl>
      <p className="finale-note">캠퍼스 여섯 운영실의 파티와 관제실 시상식은 계속됩니다.</p>
      <div className="finale-actions">
        <button type="button" className="primary ending-cta" onClick={onCredits}>🎬 엔딩 크레딧 보기</button>
        <button type="button" className="ending-button" onClick={close}>캠퍼스로 돌아가기</button>
        <MusicToggle />
      </div>
    </div>
  </div>;
}
