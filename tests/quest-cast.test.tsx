import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { scenarios } from '../src/scenarios';
import { DOMAIN_CAST, NPCS, questDomain, type QuestDomain } from '../src/ui/quest/cast';
import { createShuffleBag, ENTRANCES, nextPresentation } from '../src/ui/quest/presentation';
import { QuestBriefing } from '../src/ui/quest/QuestBriefing';
import { QuestOfficer } from '../src/ui/quest/QuestOfficer';
import { QuestBackdrop } from '../src/ui/quest/QuestBackdrop';

describe('분야별 오마주 NPC', () => {
  it('공개 명령 목록으로 웹과 DB를 구분하고 다른 분야를 바꾸지 않는다', () => {
    expect(questDomain('web-db', ['help', 'mysql'])).toBe('database');
    expect(questDomain('web-db', ['help', 'nginx'])).toBe('web');
    expect(questDomain('web-db')).toBe('web');
    expect(questDomain('linux', ['mysql'])).toBe('linux');
    for (const s of scenarios) {
      const domain = questDomain(s.category, s.commands);
      expect(DOMAIN_CAST[domain].length).toBeGreaterThan(0);
      for (const id of DOMAIN_CAST[domain]) expect(NPCS[id]).toBeDefined();
    }
  });
  it('한 카테고리에서 다른 분야 인물을 뽑지 않고 K8s는 세 사람을 모두 보여 준다', () => {
    for (const domain of Object.keys(DOMAIN_CAST) as QuestDomain[]) {
      const seen = new Set<string>();
      for (let i = 0; i < 15; i++) {
        const scene = nextPresentation(domain);
        expect(DOMAIN_CAST[domain]).toContain(scene.npc);
        seen.add(scene.npc);
      }
      expect([...seen].sort()).toEqual([...DOMAIN_CAST[domain]].sort());
    }
  });
  it('쿠버네티스 당직자는 연속되지 않고 웹/DB의 출동이 순서를 소모하지 않는다', () => {
    let previous = '';
    for (let i = 0; i < 30; i++) {
      const npc = nextPresentation('kubernetes').npc;
      expect(npc).not.toBe(previous);
      previous = npc;
      nextPresentation('database'); nextPresentation('web');
    }
  });
  it('아홉 인물은 각각 다른 벡터 외형이고 사진을 외부에서 받지 않는다', () => {
    const portraits = Object.values(NPCS).map(npc => renderToStaticMarkup(<QuestOfficer npc={npc} />));
    expect(new Set(portraits).size).toBe(9);
    for (const html of portraits) {
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toMatch(/<image|<img|https?:/);
    }
  });
  it('일곱 공간은 서로 다른 장식이며 숨겨진 게임 상태를 요구하지 않는다', () => {
    const rooms = (Object.keys(DOMAIN_CAST) as QuestDomain[]).map(domain => renderToStaticMarkup(<QuestBackdrop domain={domain} />));
    expect(new Set(rooms).size).toBe(7);
    for (const html of rooms) expect(html).toContain('aria-hidden="true"');
  });
});

describe('랜덤 등장 연출', () => {
  it('다섯 장면을 한 바퀴에 모두 보여 주고 바퀴 경계에서도 반복하지 않는다', () => {
    expect(ENTRANCES).toHaveLength(5);
    for (const random of [() => 0, () => .5, () => .999999]) {
      const draw = createShuffleBag(ENTRANCES, random);
      let previous = '';
      for (let cycle = 0; cycle < 20; cycle++) {
        const seen = new Set<string>();
        for (let i = 0; i < 5; i++) {
          const next = draw();
          expect(next).not.toBe(previous);
          previous = next; seen.add(next);
        }
        expect([...seen].sort()).toEqual([...ENTRANCES].sort());
      }
    }
  });
  it('인물 하나인 분야는 안정적으로 유지하고 빈 목록은 거부한다', () => {
    const draw = createShuffleBag(['앤디']);
    expect([draw(), draw(), draw()]).toEqual(['앤디', '앤디', '앤디']);
    expect(() => createShuffleBag([])).toThrow();
  });
  it('재렌더는 랜덤 선택을 소모하지 않고 모든 장면에서 수락 전에는 시작하지 않는다', () => {
    const onAccept = vi.fn(), random = vi.fn(() => .5);
    const draw = createShuffleBag(ENTRANCES, random);
    for (const entrance of ENTRANCES) {
      const props = { title: '공개 제목', ticket: '원인 없는 증상 <script>숨김</script>', room: '운영실',
        accent: '#00d4ff', mission: '01', motion: false, onAccept, onClose: () => {}, domain: 'linux' as const,
        presentation: { npc: 'linus' as const, entrance, take: 1 } };
      const html = renderToStaticMarkup(<QuestBriefing {...props} />);
      expect(renderToStaticMarkup(<QuestBriefing {...props} />)).toBe(html);
      expect(html).toContain(`data-entrance="${entrance}"`);
      expect(html).toContain('리누스의 작은 단서');
      expect(html).toContain('원인 없는 증상 &lt;script&gt;');
      expect(html).not.toContain('연출 건너뛰기');
      expect(html).not.toContain('리누스 토르발스'); // 이름의 단서는 누른 뒤에만.
    }
    expect(random).not.toHaveBeenCalled();
    draw(); expect(random).toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
