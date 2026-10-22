/** 모니터·연결선은 장식이며 실습 상태를 표시하지 않는다. */
export function LinuxWorkshop() {
  return <g>
    <path d="M0 90 285 45V262L0 310Z" fill="#3b3029" /><path d="M0 100 285 55M0 145 285 100M0 190 285 145M0 235 285 190" stroke="#806043" opacity=".3" />
    <path d="m24 230 192-40 108 37-201 51Z" fill="#826249" /><path d="m24 230 99 48v22L24 253Zm99 48 201-51v21l-201 52" fill="#483c35" />
    <g transform="translate(68 110) rotate(-7)"><rect width="144" height="96" rx="7" fill="#797365" /><rect x="9" y="9" width="126" height="73" rx="3" fill="#111e20" /><path d="m23 29 9 8-9 8m18 0h22m-40 13h75m-75 10h53" stroke="#9bc4a2" strokeWidth="3" fill="none" /><path d="M55 96v12h43V96" fill="#5c594e" /></g>
    <g transform="translate(236 194)"><ellipse cy="9" rx="17" ry="25" fill="#101d24" /><ellipse cy="15" rx="11" ry="16" fill="#dee4d7" /><circle cx="-5" cy="-2" r="3" fill="#e7edde" /><circle cx="5" cy="-2" r="3" fill="#e7edde" /><path d="m-5 4 10 0-5 7Z" fill="#d7ab57" /></g>
    <path d="M700 70h205v180H700Z" fill="#202e33" stroke="#536767" />
    {Array.from({length:7},(_,i)=><g key={i} transform={`translate(715 ${85+i*22})`}><rect width="175" height="16" rx="2" fill="#314047" /><path d="M8 8h92" stroke="#17292f" strokeWidth="4" /><circle cx="155" cy="8" r="2" fill="#dfb96e" /></g>)}
    <path d="M640 25h210l25 10H625Z" fill="#dbbf8d" opacity=".55" />
  </g>;
}
export function NetworkExchange() {
  return <g>
    <circle cx="160" cy="152" r="94" fill="#142a34" stroke="#5c9baf" /><g stroke="#5590a0" fill="none" opacity=".6"><ellipse cx="160" cy="152" rx="49" ry="94" /><ellipse cx="160" cy="152" rx="94" ry="36" /><path d="M66 152h188m-94-94v188" /></g>
    <g className="quest-signal" fill="none" stroke="#7ebcc5" strokeWidth="2"><path d="M73 162Q154 33 242 129M86 209Q163 123 223 90" /><path d="M652 110h52v84h65v-46h100" /></g>
    {[ [73,162], [242,129], [86,209], [223,90] ].map(([x,y])=><circle key={x} cx={x} cy={y} r="5" fill="#bfe2d8" />)}
    <g transform="translate(705 55)"><rect width="194" height="212" rx="5" fill="#263d47" stroke="#658694" />{[0,1,2,3].map(i=><g key={i} transform={`translate(15 ${18+i*47})`}><rect width="164" height="30" fill="#172a35" />{[0,1,2,3,4,5,6,7].map(j=><rect key={j} x={8+j*19} y="9" width="12" height="11" fill="#49737d" stroke="#8eb2b5" strokeWidth=".5" />)}</g>)}<path d="M28 33v55q0 28 46 28t46 21v38M140 33v18q0 15-36 15T68 94v90" fill="none" stroke="#b9a164" strokeWidth="3" /></g>
    <path d="M35 23h890" stroke="#315d6c" strokeWidth="4" />
  </g>;
}
export function WebLaboratory() {
  return <g>
    <path d="M15 54h278v214H15Z" fill="#22313f" stroke="#56788a" /><path d="M30 73h248v160H30Z" fill="#11232d" />
    <g stroke="#86b9c0" fill="none" strokeWidth="2"><path d="m48 102 13-9-13-9m27 18h51M49 130h84m-84 12h153m-153 12h128m-128 12h140M50 198h94" /><path d="m270 155 45 0 0-60 315 0 0 76 90 0" className="quest-signal" strokeDasharray="5 7" /></g>
    <g transform="translate(720 50) rotate(5)"><rect width="180" height="214" rx="4" fill="#98aeb6" /><path d="M0 29h180" stroke="#607f92" /><circle cx="14" cy="15" r="3" fill="#527283" /><circle cx="26" cy="15" r="3" fill="#527283" /><path d="M18 52h103m-103 16h134m-134 16h118M18 172h113m-113 15h136" stroke="#51718a" strokeWidth="4" /><path d="M20 108h64v42H20Zm80 0h61v42h-61Z" fill="#547f91" /><path d="m42 130 12-7 13 8m48-5h31" stroke="#b6d0cf" fill="none" strokeWidth="3" /></g>
    <path d="m40 279 214-14 48 18-224 23Z" fill="#4f6877" />
  </g>;
}
export function DataArchive() {
  return <g>
    <path d="M15 40h280v228H15Z" fill="#3a3440" stroke="#74667a" />
    {[0,1,2].map(i=><g key={i} transform={`translate(${40+i*80} 58)`}><rect width="61" height="191" fill="#292733" />{Array.from({length:6},(_,j)=><g key={j} transform={`translate(6 ${8+j*29})`}><rect width="49" height="22" fill={j%2?'#615568':'#4d495c'} /><path d="M19 7h13" stroke="#c2b196" strokeWidth="3" /></g>)}</g>)}
    <g transform="translate(768 120)">{[70,35,0].map(y=><g key={y} transform={`translate(0 ${y})`}><path d="M-68 0v29c0 30 136 30 136 0V0" fill="#586674" stroke="#9ba8b4" /><ellipse rx="68" ry="19" fill="#7a8991" stroke="#b8c7c7" /><path d="M-48 31h13" stroke="#d7b77c" strokeWidth="3" /></g>)}</g>
    <g transform="translate(630 245) scale(.7)"><path d="M0 0Q36-29 73-18l30-13-9 22 13 12-29-8Q47 8 24 3L6 17l8-19Z" fill="#9cbac1" /><circle cx="73" cy="-14" r="2" fill="#253541" /></g>
    <path d="m650 267 220-7 49 20-223 15Z" fill="#4a4858" />
  </g>;
}
