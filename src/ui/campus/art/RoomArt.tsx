import type { ComponentType } from "react";
import type { Category } from "../../../engine/scenario/types";
import type { RoomKind } from "../rooms";
import { CloudArt } from "./CloudArt";
import { CommunityArt } from "./CommunityArt";
import { ControlArt, type MapRoom, type WallStat } from "./ControlArt";
import { DockerArt } from "./DockerArt";
import { KubernetesArt } from "./KubernetesArt";
import { LibraryArt } from "./LibraryArt";
import { LinuxArt } from "./LinuxArt";
import { NetworkArt } from "./NetworkArt";
import { WebDbArt } from "./WebDbArt";
import { PartyContext } from "../party/context";
import { KickoffBurst } from "../party/parts";

export interface ControlData { stats: WallStat[]; total: WallStat; clock: string; rooms: MapRoom[] }

// 분류별 운영실 그림. Record라서 새 분류의 그림을 빠뜨리면 컴파일이 실패한다.
const LAB_ART: Record<Category, ComponentType> = {
  linux: LinuxArt, network: NetworkArt, "web-db": WebDbArt, aws: CloudArt, docker: DockerArt, kubernetes: KubernetesArt,
};

/** 방 종류에 맞는 실내 그림. 관제실은 실제 학습 기록을 받아야 그릴 수 있다. */
function Art({ kind, control }: { kind: RoomKind; control?: ControlData }) {
  if (kind === "control") return control ? <ControlArt {...control} /> : null;
  if (kind === "library") return <LibraryArt />;
  if (kind === "community") return <CommunityArt />;
  const Lab = LAB_ART[kind];
  return <Lab />;
}

/**
 * 방 그림 + 파티. party면 방 안의 사람·장식이 파티 모드로 바뀌고(PartyContext),
 * kickoff면 처음 열리는 파티의 시작 연출(축포)을 한 번 얹는다.
 */
export function RoomArt({ kind, control, party = false, kickoff = false, accent = "#ffd447" }:
  { kind: RoomKind; control?: ControlData; party?: boolean; kickoff?: boolean; accent?: string }) {
  return <PartyContext.Provider value={party}>
    <Art kind={kind} control={control} />
    {kickoff && <KickoffBurst center={[5, 5, 2.2]} color={accent} />}
  </PartyContext.Provider>;
}
