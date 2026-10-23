function Container({ x, y, color }: { x: number; y: number; color: string }) {
  return <g transform={`translate(${x} ${y})`}><path d="m0 0 88-12 44 20-88 13Z" fill={color} /><path d="M0 0v43l44 22V21Z" fill={color} /><path d="m44 21 88-13v43L44 65Z" fill={color} /><path d="m44 21 88-13v43L44 65Z" fill="#061622" opacity=".3" /><path d="m54 25 0 31m12-33v31m12-33v31m12-33v31m12-33v31m12-33v31M7 9v30m12-24v30m12-24v30" stroke="#b4d4d0" opacity=".2" strokeWidth="2" /></g>;
}
export function ContainerHarbor() {
  return <g>
    <path d="M0 180h960v140H0Z" fill="#173f52" />
    <g className="quest-water" fill="none" stroke="#3e7c91"><path d="M0 206h170m410 0h175m75 0h100M15 232h120m600 0h82m105 0h130M80 280h120m450 0h160m65 0h105" /></g>
    <path d="M77 188V40h187v148M77 50h187m-165 0 49 60 49-60 54 63M232 50v65l-8 10" fill="none" stroke="#75877d" strokeWidth="7" />
    <path d="m10 247 186-45 140 53-182 56Z" fill="#57636a" />
    <Container x={33} y={176} color="#5b8791" /><Container x={124} y={205} color="#4b7a82" /><Container x={33} y={129} color="#ab865d" />
    <path d="M689 229h245l-35 48H720Z" fill="#405661" /><Container x={706} y={165} color="#607783" /><Container x={772} y={139} color="#4c8190" />
    <g transform="translate(609 261)"><path d="M0 0q24-5 31-20l12 14 16-8-4 17Q34 31 5 18L-8 9Z" fill="#7ab4c4" /><circle cx="10" cy="7" r="2" fill="#1a3d50" /></g>
  </g>;
}
export function ClusterBridge() {
  return <g>
    <path d="M0 35h960v189H0Z" fill="#223449" /><path d="M0 133h960v91H0Z" fill="#25455c" /><path d="M0 159q140-12 240 0t230 0 250 0 240 0" fill="none" stroke="#4a6e84" />
    <path d="m0 30 300 0-27 202H0m960-202H660l27 202h273M480 30v202" fill="none" stroke="#536979" strokeWidth="12" />
    <g transform="translate(154 159)" fill="none" stroke="#c4ac82" strokeWidth="6"><circle r="55" /><circle r="12" />{Array.from({length:8},(_,i)=><path key={i} d="M0-12V-70" transform={`rotate(${i*45})`} />)}</g>
    <path d="m658 238 231-13 45 48-253 22Z" fill="#3b5267" />
    <g transform="translate(700 63)"><rect width="192" height="155" rx="5" fill="#142638" stroke="#6a91b0" /><g fill="none" stroke="#739bb8" strokeWidth="2"><path d="m95 33-60 73h120Zm0 0v104M35 106h120" className="quest-signal" strokeDasharray="4 6" /></g>{[[95,33],[35,106],[155,106]].map(([x,y])=><g key={x} transform={`translate(${x} ${y})`}><path d="m0-14 14 7v14L0 15-14 7V-7Z" fill="#436f98" stroke="#9ab6cc" /><circle r="3" fill="#b6d7df" /></g>)}</g>
    <path d="m57 73 12-5 12 5m189 25 12-5 12 5" fill="none" stroke="#afbfc8" strokeWidth="2" />
  </g>;
}
export function CloudObservatory() {
  return <g>
    <path d="M20 30h920v237H20Z" fill="#1e344b" stroke="#698092" strokeWidth="4" />
    <path d="M20 137h920M240 30v237M720 30v237" stroke="#536878" strokeWidth="6" />
    <g fill="#8da3b3" opacity=".3"><path d="M40 115q-20-28 12-41 5-43 46-28 31-24 49 14 40-8 43 29 28 6 23 26Z" /><path d="M725 171q-28-24 3-43 2-46 42-28 28-31 53 6 44-6 42 31 36 1 36 34Z" /></g>
    {[0,1,2,3,4].map(i=><g key={i} transform={`translate(${745+i*33} ${221-i%3*16})`}><rect width="24" height="65" fill="#263b50" /><path d="M6 9h12m-12 10h12m-12 10h12" stroke="#66828e" strokeWidth="2" /></g>)}
    <path d="m30 265 210-30 51 28-209 34Z" fill="#59697a" /><path d="m66 243-3-56 98-14 9 62Z" fill="#253e54" stroke="#6d94ac" /><path d="m80 203 29-4m-29 15 62-9" stroke="#9cb6c7" strokeWidth="3" />
  </g>;
}
