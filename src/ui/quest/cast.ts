import type { Category } from '../../engine/scenario/categories';

export type QuestDomain = 'linux' | 'network' | 'web' | 'database' | 'aws' | 'docker' | 'kubernetes';
export type NpcId = 'doyun' | 'linus' | 'vint' | 'tim' | 'monty' | 'solomon' | 'brendan' | 'joe' | 'craig';
export interface QuestNpc {
  id: NpcId; name: string; callSign: string; mark: string; role: string; clue: string; homage: string;
  hair: string; hairStyle: 'short' | 'swept' | 'bald' | 'receding' | 'curly';
  beard?: string; glasses?: 'round' | 'square'; jacket: string; shirt: string; tie?: boolean;
}

export const NPCS: Record<NpcId, QuestNpc> = {
  doyun: { id: 'doyun', name: '도윤', callSign: 'DOYUN', mark: 'D.', role: '클라우드 온콜 엔지니어',
    clue: '오늘도 함께, 한 단계씩', homage: 'SUDO QUEST의 오리지널 선임 운영자입니다.',
    hair: '#182530', hairStyle: 'short', beard: '#1c2931', glasses: 'round', jacket: '#294b5b', shirt: '#0e1e2c' },
  linus: { id: 'linus', name: '리누스', callSign: 'LINUS', mark: 'L.', role: '시스템 작업실의 선임',
    clue: '작은 펭귄 · 1991', homage: '리누스 토르발스 · Linux 커널 창시자',
    hair: '#8b7962', hairStyle: 'short', glasses: 'square', jacket: '#344c66', shirt: '#bbcbd8' },
  vint: { id: 'vint', name: '빈트', callSign: 'VINT', mark: 'V.', role: '패킷 교환실의 설계자',
    clue: '서로 다른 망을 잇는 일', homage: '빈트 서프 · 밥 칸과 함께 TCP/IP 설계',
    hair: '#d9dbd6', hairStyle: 'bald', beard: '#e2e2d8', jacket: '#354456', shirt: '#d5e0dd', tie: true },
  tim: { id: 'tim', name: '팀', callSign: 'TIM', mark: 'T.', role: '하이퍼텍스트 연구실의 선임',
    clue: '작은 링크 · 1989', homage: '팀 버너스리 · 월드 와이드 웹 발명',
    hair: '#95846b', hairStyle: 'swept', jacket: '#394e5b', shirt: '#b4c9dc' },
  monty: { id: 'monty', name: '몬티', callSign: 'MONTY', mark: 'M.', role: '데이터 보관소의 장인',
    clue: '책상 위 돌고래 한 마리', homage: '마이클 ‘몬티’ 비데니우스 · MySQL 주요 개발자·공동 창업자',
    hair: '#927551', hairStyle: 'receding', jacket: '#536775', shirt: '#b9d3df' },
  solomon: { id: 'solomon', name: '솔로몬', callSign: 'SOLOMON', mark: 'S.', role: '컨테이너 부두의 선장',
    clue: '고래와 상자들 · 2013', homage: '솔로몬 하이크스 · Docker 프로젝트 창시자',
    hair: '#302922', hairStyle: 'curly', beard: '#49372d', jacket: '#324753', shirt: '#182b36' },
  brendan: { id: 'brendan', name: '브렌던', callSign: 'BRENDAN', mark: 'B.', role: '클러스터 항해실의 설계자',
    clue: '세 명의 항해사 · 2014', homage: '브렌던 번스 · Kubernetes 초기 개발을 이끈 세 사람 중 한 명',
    hair: '#6c675d', hairStyle: 'swept', glasses: 'round', jacket: '#36485c', shirt: '#253341' },
  joe: { id: 'joe', name: '조', callSign: 'JOE', mark: 'J.', role: '클러스터 항해실의 설계자',
    clue: '세 명의 항해사 · 2014', homage: '조 베다 · Kubernetes 초기 개발을 이끈 세 사람 중 한 명',
    hair: '#737166', hairStyle: 'bald', beard: '#8f8a7a', glasses: 'square', jacket: '#365b6d', shirt: '#244150' },
  craig: { id: 'craig', name: '크레이그', callSign: 'CRAIG', mark: 'C.', role: '클러스터 항해실의 설계자',
    clue: '세 명의 항해사 · 2014', homage: '크레이그 맥러키 · Kubernetes 초기 개발을 이끈 세 사람 중 한 명',
    hair: '#463f36', hairStyle: 'short', glasses: 'square', jacket: '#5d5867', shirt: '#c9c8d4' },
};
export const DOMAIN_CAST: Record<QuestDomain, readonly NpcId[]> = {
  linux: ['linus'], network: ['vint'], web: ['tim'], database: ['monty'], aws: ['doyun'],
  docker: ['solomon'], kubernetes: ['brendan', 'joe', 'craig'],
};

/** 공개 help 목록으로 웹/DB만 구분한다. 장애·정답·전체 상태는 받지 않는다. */
export function questDomain(category: Category, commands: readonly string[] = []): QuestDomain {
  return category === 'web-db' ? (commands.includes('mysql') ? 'database' : 'web') : category;
}
