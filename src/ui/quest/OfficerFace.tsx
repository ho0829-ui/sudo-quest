import type { QuestNpc } from './cast';

/** 기존 각진 3/4 인체 비율에 헤어라인·안경·수염을 다르게 그린 게임 속 오마주. */
export function OfficerFace({ npc }: { npc: QuestNpc }) {
  const { hair, hairStyle, beard, glasses } = npc;
  return <g>
    <path d="M107 83 109 59 125 44 148 31 176 31 198 44 214 66 216 99 206 133 187 155 142 156 116 137 106 112Z" fill={hairStyle === 'bald' ? '#dfb38e' : hair} />
    <path d="m117 78 17-19 31-7 33 20 8 30-7 31-23 22-31-6-24-22Z" fill="#e4b68c" />
    <path d="m176 58 22 14 8 30-7 31-23 22-8-13 12-23Z" fill="#ce9972" />
    <path d="m108 95-8 3-2 16 9 13 13-2-1-23Z" fill="#d7a17d" />
    <path d="m107 105 5 4v10" stroke="#a56d54" strokeWidth="3" fill="none" />
    {hairStyle === 'short' && <path d="m114 81-5-18 16-20 24-12 28 1 20 12 14 21-25-3-21-14-17 14-18 2Z" fill={hair} />}
    {hairStyle === 'swept' && <path d="m109 88-6-24 18-23 28-14 35 6 25 19 5 26-18-10-17-19-16 22-33-7-12 27Z" fill={hair} />}
    {hairStyle === 'receding' && <path d="m107 91-7-25 19-23 28-12 28 1 27 15 15 25-5 35-12-17-8-34-29-11-31 13-14 27-1 17Z" fill={hair} />}
    {hairStyle === 'curly' && <path d="M106 93 100 75 109 65 108 53 124 46 133 35 148 37 160 30 174 37 192 35 201 48 215 56 212 69 221 84 214 104 200 92 197 75 175 66 163 74 146 64 132 75 115 77Z" fill={hair} />}
    {hairStyle === 'bald' ? <>
      <path d="m108 68 11-14-6 34 5 15-10 4-4-15Zm94-8 10 14 4 23-10 13-8-15Z" fill={hair} />
      <path d="m135 48 22-7 18 4" stroke="#f0d1ad" strokeWidth="3" fill="none" />
    </> : <path d="m111 72 8-7 4 28-8 10-6-10Zm88 1 10 7 1 22-10 9Z" fill={hair} />}
    <path d="m126 86 14-3m31 2 14 4" stroke={hair} strokeWidth="4" strokeLinecap="round" />
    {glasses && <g fill="#a7d8d612" stroke="#283643" strokeWidth={glasses === 'round' ? 2.5 : 4}>
      <rect x="120" y="91" width="30" height="24" rx={glasses === 'round' ? 12 : 4} />
      <rect x="163" y="93" width="30" height="24" rx={glasses === 'round' ? 12 : 4} />
      <path d="m150 100 13 1m-45-4-9-2m85 7 9 1" fill="none" />
    </g>}
    <g className="quest-eyes" fill="#172a33"><rect x="134" y="98" width="4" height="8" rx="2" /><rect x="175" y="100" width="4" height="8" rx="2" /></g>
    <path d="m156 101-4 17 10 3" fill="none" stroke="#ac7557" strokeWidth="3" strokeLinecap="round" />
    {beard && <>
      <path d="m118 112 11 12 10-2 15 7 15-6 15 4 15-11-3 26-16 23-31 4-24-18-9-24Z" fill={beard} />
      <path d="m128 125 14 5 12-1 15-4 18 7-5 8-14-5-14 4-16-4-8 2Z" fill={hair} />
      <path d="m127 140 4 9m8 1 4 7m37-7-5 7" stroke="#b5b5a8" opacity=".4" strokeWidth="2" />
    </>}
    <path d={beard ? 'm148 141 17 3 10-4' : 'm142 134 17 4 17-3'} stroke={beard ? '#dfb894' : '#9b6653'} strokeWidth="3" strokeLinecap="round" fill="none" />
  </g>;
}
