import type { QuestDomain } from './cast';
import { DataArchive, LinuxWorkshop, NetworkExchange, WebLaboratory } from './backdrops/Workshops';
import { CloudObservatory, ClusterBridge, ContainerHarbor } from './backdrops/Harbors';

export const BACKDROP_NAMES: Record<QuestDomain, string> = {
  linux: '커널 작업실', network: '패킷 교환실', web: '하이퍼텍스트 연구실', database: '데이터 보관소',
  aws: '클라우드 전망대', docker: '컨테이너 부두', kubernetes: '클러스터 항해실',
};
const ROOMS = { linux: LinuxWorkshop, network: NetworkExchange, web: WebLaboratory, database: DataArchive,
  aws: CloudObservatory, docker: ContainerHarbor, kubernetes: ClusterBridge };

export function QuestBackdrop({ domain }: { domain: QuestDomain }) {
  const Room = ROOMS[domain];
  return <div className="quest-set" aria-hidden="true">
    <svg className="quest-backdrop" viewBox="0 0 960 320" preserveAspectRatio="xMidYMid slice">
      <path d="M0 260h960v60H0Z" fill="#192734" />
      <path d="M0 320 420 180m540 140L540 180M0 290h960" stroke="#7390a2" opacity=".12" />
      <Room />
    </svg>
    <div className="quest-atmosphere" />
  </div>;
}
