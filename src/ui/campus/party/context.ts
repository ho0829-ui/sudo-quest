import { createContext, useContext } from "react";

/**
 * 이 방이 파티 중인가. 방 그림(RoomArt)이 감싸 주면, 그 안의 사람들(Person)이 스스로 파티 차림·자세로 바뀐다.
 * 그래서 방마다 사람을 다시 그리지 않아도 된다.
 */
export const PartyContext = createContext(false);

/**
 * 파티 장식은 방 그림 안의 "그려야 할 순서" 자리에 미리 꽂아 두고, 파티 중일 때만 나타난다.
 * 아이소메트릭은 뒤에서 앞으로 그려야 겹침이 맞으므로, 장식을 방 그림 위에 한꺼번에 얹지 않는다.
 */
export function useParty(): boolean {
  return useContext(PartyContext);
}

/** 고깔모자 색. 셔츠 색에서 고르므로 같은 사람은 늘 같은 모자를 쓴다. */
export const HAT_COLORS = ["#ff5fa2", "#ffd447", "#5cc8ff", "#7dff9b", "#b48bff", "#ff8a3d"];
