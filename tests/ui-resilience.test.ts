import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProgress, saveClear } from '../src/ui/storage';
import { isHealth, getHealth } from '../src/api/health';
import { shuffleChoices } from '../src/ui/shuffleChoices';

const record = { cleared: true, bestScore: 800, clearedAt: 1000 };
afterEach(() => vi.unstubAllGlobals());
function storage(raw: string | null) {
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', { getItem: () => raw, setItem });
  return setItem;
}

describe('진행 기록 복원', () => {
  it.each(['null', '[]', '123', '{broken'])('손상된 최상위 값 %s을 무시한다', raw => {
    storage(raw); expect(loadProgress()).toEqual({});
  });
  it('유효한 기록만 복원한다', () => {
    storage(JSON.stringify({ good: record, missing: {}, bad: { ...record, bestScore: '999' }, negative: { ...record, bestScore: -1 }, oversized: { ...record, bestScore: 1001 }, falseClear: { ...record, cleared: false } }));
    expect(loadProgress()).toEqual({ good: record });
  });
  it('저장 공간이 막혀도 완료 기록을 반환한다', () => {
    const set = storage(null); set.mockImplementation(() => { throw new Error('quota'); });
    expect(saveClear('test', 900).test.bestScore).toBe(900);
  });
  it('기존 최고 점수를 낮추지 않는다', () => {
    storage(JSON.stringify({ test: record })); expect(saveClear('test', 500).test.bestScore).toBe(800);
  });
});

const health = {
  status: 'ok', service: 'InfraCoach',
  providers: { generation: { configured: false, missing: ['LLM_API_KEY'], verified: false }, embedding: { configured: false, missing: [], verified: false } },
  index: { status: 'empty', counts: { knowledge_items: 0 } }, rag_status: 'index_required',
};
describe('상태 API 경계', () => {
  it('키 없는 정상 서버 상태도 허용한다', () => expect(isHealth(health)).toBe(true));
  it.each([null, {}, { ...health, providers: {} }, { ...health, index: {} }, { ...health, index: { status: 'empty', counts: { a: -1 } } }, { ...health, providers: { ...health.providers, generation: { missing: null } } }])('렌더링을 깨뜨리는 응답을 거부한다', value => {
    expect(isHealth(value)).toBe(false);
  });
  it('잘못된 응답을 연결 오류로 처리한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...health, providers: {} }) }));
    await expect(getHealth()).rejects.toThrow('invalid_health_response');
  });
});

describe('원인 보기 순서', () => {
  it('원본을 보존하고 정답 위치를 변경할 수 있다', () => {
    const choices = ['answer', 'b', 'c', 'd'];
    const shuffled = shuffleChoices(choices, () => 0);
    expect(shuffled).toEqual(['b', 'c', 'd', 'answer']);
    expect(choices).toEqual(['answer', 'b', 'c', 'd']);
  });
  it('빈 보기와 단일 보기를 처리한다', () => {
    expect(shuffleChoices([])).toEqual([]); expect(shuffleChoices(['a'])).toEqual(['a']);
  });
});

