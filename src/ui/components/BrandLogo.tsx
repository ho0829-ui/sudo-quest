/**
 * SUDO QUEST 픽셀 로고: 보라 터미널 창 + 초록 프롬프트(>_) + 금빛 검(퀘스트).
 * sudo(관리자 권한 명령)를 받아 장애 퀘스트를 푼다는 뜻이다. 외부 이미지 없이 사각형으로만 그린다.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  return <svg className="brand-pixel" width={size} height={size} viewBox="0 0 34 34" shapeRendering="crispEdges" aria-hidden="true">
    <rect x={3} y={5} width={26} height={21} fill="#07090e" stroke="#a259ff" strokeWidth={2} />
    <rect x={3} y={5} width={26} height={5} fill="#a259ff" />
    <rect x={5} y={7} width={2} height={1} fill="#ff2d95" /><rect x={8} y={7} width={2} height={1} fill="#ffd23f" />
    {/* 프롬프트 > */}
    <rect x={7} y={13} width={2} height={2} fill="#2cff8f" /><rect x={9} y={15} width={2} height={2} fill="#2cff8f" />
    <rect x={7} y={17} width={2} height={2} fill="#2cff8f" />
    <rect className="brand-cursor" x={13} y={18} width={6} height={2} fill="#2cff8f" />
    {/* 검: 날, 손잡이 가드, 손잡이 */}
    <rect x={25} y={14} width={3} height={12} fill="#ffe27a" />
    <rect x={26} y={13} width={1} height={1} fill="#ffe27a" />
    <rect x={21} y={25} width={11} height={2} fill="#ffd23f" />
    <rect x={25} y={27} width={3} height={4} fill="#b38f12" />
    <rect x={25} y={31} width={3} height={1} fill="#ffd23f" />
  </svg>;
}
