import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalLoader } from '../src/ui/components/TerminalLoader';
import { QuestBriefing } from '../src/ui/quest/QuestBriefing';
import { TicketScreen } from '../src/ui/screens/TicketScreen';
import { questDialogue } from '../src/ui/quest/dialogue';
import { scenarios } from '../src/scenarios';

describe('퀘스트 브리핑 경계', () => {
  it('모든 실습에서 공개 티켓의 전체 증상을 보존한다', () => {
    for (const scenario of scenarios) {
      const pages = questDialogue(scenario.title, scenario.ticket);
      expect(pages[0].heading).toBe(scenario.title);
      expect(pages[0].text).toContain(scenario.ticket);
      expect(pages[1].text).toContain('원인은 단정할 수 없어요');
    }
  });
  it('수락 전 렌더링으로 게임을 시작하지 않으며 비공개 필드를 출력하지 않는다', () => {
    const scenario = { ...scenarios[0], title: '공개 제목', ticket: '공개 신고', id: 'HIDDEN_SCENARIO',
      learningObjectives: ['HIDDEN_OBJECTIVE'], solutionPath: ['HIDDEN_SOLUTION'] };
    const onStart = vi.fn();
    const html = renderToStaticMarkup(<TicketScreen scenario={scenario} motion={false} onStart={onStart} onBack={() => {}} />);
    expect(html).toContain('공개 신고');
    expect(html).not.toContain('HIDDEN_');
    expect(onStart).not.toHaveBeenCalled();
  });
  it('모션을 끄면 대화 내용을 즉시 렌더링하고 자동 수락하지 않는다', () => {
    const onAccept = vi.fn();
    const html = renderToStaticMarkup(<QuestBriefing title="공개 제목" ticket={'줄1\n줄2 <script>alert(1)</script>'}
      room="운영실" accent="#00d4ff" mission="01" motion={false} onAccept={onAccept} onClose={() => {}} />);
    expect(html).toContain('상황 확인했어요');
    expect(html).toContain('줄1\n줄2 &lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('연출 건너뛰기');
    expect(onAccept).not.toHaveBeenCalled();
  });
  it('이어하기는 새 퀘스트 문구와 구별한다', () => {
    const html = renderToStaticMarkup(<TicketScreen scenario={scenarios[0]} resumable onStart={() => {}} onBack={() => {}} />);
    expect(html).toContain('조사 이어서 하기');
  });
});

describe('작은 CLI 로더', () => {
  it('상태 문구 하나를 읽고 SVG 장식은 보조기기에서 제외한다', () => {
    const html = renderToStaticMarkup(<TerminalLoader compact label="<연결 확인 중>" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('&lt;연결 확인 중&gt;');
    expect(html).not.toContain('<img');
  });
});
