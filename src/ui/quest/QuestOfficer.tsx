import { NPCS, type QuestNpc } from './cast';
import { OfficerFace } from './OfficerFace';

export function QuestOfficer({ npc = NPCS.andy }: { npc?: QuestNpc }) {
  return <svg viewBox="0 0 320 480" className="quest-officer" aria-hidden="true" focusable="false">
    <ellipse cx="160" cy="461" rx="79" ry="13" fill="#03070c" opacity=".65" />
    {/* 뒤쪽 팔·바지와 신발. 몸의 오른쪽 면은 어둡게 해서 3/4 입체감을 낸다. */}
    <path d="M206 185 244 208 260 310 232 325 207 250Z" fill="#183244" />
    <path d="m232 312 27-7 3 25-12 15-18-5Z" fill="#cb936e" />
    <path d="m112 302 104 1-4 72-10 75-37 1-4-100-14 98-37-1-7-79Z" fill="#253345" />
    <path d="m164 313 52-10-4 72-10 75-26 1 4-90Z" fill="#172330" />
    <path d="m109 441 38 2 3 16-20 8-36-3v-14Z" fill="#0c1520" />
    <path d="m165 444 37-3 26 13v11h-51l-15-8Z" fill="#0c1520" />
    <path d="m99 461 32 3 20-7M176 462h48" stroke="#4e6473" strokeWidth="3" fill="none" />
    {/* 작업 재킷, 지퍼, 사원증. */}
    <path d="m112 177 40-15 37 4 35 22-7 126-56 15-57-16-9-95Z" fill={npc.jacket} />
    <path d="m180 170 44 18-7 126-37 10Z" fill="#1c3545" />
    <path d="m132 169 21-8 30 4 14 18-32 43Z" fill={npc.shirt} />
    <path d="m138 162 1-24 41-1 2 30-17 20Z" fill="#ca926e" />
    <path d="m130 165 35 26-18 23-22-40M183 166l-18 25 20 22 14-33" fill="#416274" />
    <path d="M165 213v111" stroke="#91b9c5" strokeWidth="2" opacity=".55" />
    <path d="m107 208 35 7m42 0 30-6" stroke="#56d9e4" strokeWidth="4" />
    <rect x="113" y="239" width="31" height="27" rx="3" fill="#203a49" stroke="#4e7182" />
    <path d="m119 245 7 6-7 6m12 0h7" fill="none" stroke="#70dce2" strokeWidth="2" />
    <path d="m193 222-1 21" stroke="#c4a46e" strokeWidth="3" />
    <rect x="180" y="240" width="27" height="35" rx="3" fill="#b5cbd1" transform="rotate(-5 193 253)" />
    <path d="M186 263h14m-14 5h10" stroke="#436571" strokeWidth="2" /><circle cx="193" cy="252" r="5" fill="#426875" />
    {npc.tie && <path d="m159 190 12 0 5 10-8 39-10-10 5-30Z" fill="#bca470" />}
    <OfficerFace npc={npc} />
    {/* 앞으로 안은 태블릿과 한 손. */}
    <path d="m112 188-25 18-15 72 18 27 24-12 1-62 9-23Z" fill={npc.jacket} />
    <path d="m97 274 32-4 8 22-31 11-17-10Z" fill="#dfad83" />
    <g transform="rotate(10 144 282)"><rect x="125" y="247" width="68" height="83" rx="7" fill="#0b1927" stroke="#638a9b" strokeWidth="3" /><rect x="132" y="256" width="54" height="60" rx="3" fill="#113446" /><path d="m142 271 7 6-7 6m14 1h14m-28 12h31" stroke="#68e0dc" strokeWidth="3" fill="none" /><circle cx="159" cy="323" r="2" fill="#638a9b" /></g>
    <path d="m111 274 17-1 10 8-1 13-17-3-14-7Z" fill="#e3b38a" />
  </svg>;
}
