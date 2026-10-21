import type { ComponentType } from "react";
import type { Category } from "../../../engine/scenario/types";
import type { RoomKind } from "../rooms";
import { CloudArt } from "./CloudArt";
import { ControlArt, type MapRoom, type WallStat } from "./ControlArt";
import { LibraryArt } from "./LibraryArt";
import { LinuxArt } from "./LinuxArt";
import { NetworkArt } from "./NetworkArt";
import { WebDbArt } from "./WebDbArt";

export interface ControlData { stats: WallStat[]; total: WallStat; clock: string; rooms: MapRoom[] }

// 분류별 운영실 그림. Record라서 새 분류의 그림을 빠뜨리면 컴파일이 실패한다.
const LAB_ART: Record<Category, ComponentType> = {
  linux: LinuxArt, network: NetworkArt, "web-db": WebDbArt, aws: CloudArt,
};

/** 방 종류에 맞는 실내 그림. 관제실은 실제 학습 기록을 받아야 그릴 수 있다. */
export function RoomArt({ kind, control }: { kind: RoomKind; control?: ControlData }) {
  if (kind === "control") return control ? <ControlArt {...control} /> : null;
  if (kind === "library") return <LibraryArt />;
  const Art = LAB_ART[kind];
  return <Art />;
}
