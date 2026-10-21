import type { RoomKind } from "../rooms";
import { CloudArt } from "./CloudArt";
import { ControlArt, type MapRoom, type WallStat } from "./ControlArt";
import { LibraryArt } from "./LibraryArt";
import { LinuxArt } from "./LinuxArt";
import { NetworkArt } from "./NetworkArt";
import { WebDbArt } from "./WebDbArt";

export interface ControlData { stats: WallStat[]; total: WallStat; clock: string; rooms: MapRoom[] }

/** 방 종류에 맞는 실내 그림. 관제실은 실제 학습 기록을 받아야 그릴 수 있다. */
export function RoomArt({ kind, control }: { kind: RoomKind; control?: ControlData }) {
  if (kind === "linux") return <LinuxArt />;
  if (kind === "network") return <NetworkArt />;
  if (kind === "web-db") return <WebDbArt />;
  if (kind === "aws") return <CloudArt />;
  if (kind === "control") return control ? <ControlArt {...control} /> : null;
  return <LibraryArt />;
}
