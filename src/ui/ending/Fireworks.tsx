/**
 * 불꽃놀이 캔버스. 0.3~0.8초마다 로켓을 1~3발 쏘고(한 번씩은 크게 연발), 꽃가루를 계속 뿌린다.
 * 화면 전체를 번쩍이게 하는 효과는 쓰지 않는다(광과민성 배려): 밝기는 터진 자리 주변에만 생긴다.
 * motion이 false면 애니메이션 없이 멈춘 한 장면만 그린다.
 */
import { useEffect, useRef } from "react";
import { advance, confetti, rocket, stillFrame, type Spark } from "./sparks";

function draw(ctx: CanvasRenderingContext2D, sparks: Spark[], width: number, height: number) {
  ctx.globalCompositeOperation = "source-over";
  // 완전히 지우지 않고 반투명으로 덮어 꼬리가 남게 한다.
  ctx.fillStyle = "rgba(5, 7, 14, 0.26)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  for (const s of sparks) {
    const fade = 1 - s.life / s.max;
    ctx.globalAlpha = s.kind === "confetti" ? 0.9 : Math.max(0, fade);
    ctx.fillStyle = s.color;
    if (s.kind === "confetti") {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.life * 4 + s.x);
      ctx.fillRect(-s.size / 2, -s.size / 4, s.size, s.size / 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (s.kind === "rocket" ? 1 : 0.6 + fade * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function Fireworks({ motion }: { motion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    if (!motion) {
      ctx.clearRect(0, 0, width, height);
      draw(ctx, stillFrame(width, height), width, height);
      return () => window.removeEventListener("resize", resize);
    }

    let sparks: Spark[] = [];
    let last = performance.now();
    let nextLaunch = 0;
    let nextConfetti = 0;
    let volley = 0;
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      nextLaunch -= dt; nextConfetti -= dt;
      if (nextLaunch <= 0) {
        // 다섯 번에 한 번은 크게 연발(빵빵빵), 나머지는 한두 발.
        volley++;
        const count = volley % 5 === 0 ? 5 : 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) sparks.push(rocket(width, height, Math.random));
        nextLaunch = 0.25 + Math.random() * 0.4;
      }
      if (nextConfetti <= 0) { sparks.push(confetti(width, Math.random)); nextConfetti = 0.06; }
      sparks = advance(sparks, dt, Math.random, height);
      draw(ctx, sparks, width, height);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, [motion]);

  return <canvas ref={canvasRef} className="finale-canvas" aria-hidden="true" />;
}
