import { useId, useRef, useState, type CSSProperties } from 'react';
import type { Scenario, Category } from '../../engine/scenario/types';
import type { Progress } from '../storage';
import { Icon } from '../components/Icon';
import { CATEGORIES, OPEN_CATEGORIES } from '../categories';
import { IsoCampus } from '../campus/IsoCampus';

interface ScenarioListProps {
  scenarios: Scenario[];
  progress: Progress;
  onSelect: (scenario: Scenario) => void;
  onResetProgress: () => void;
  recordsOnly?: boolean;
  onExplore: () => void;
  onOpenRecords: () => void;
}
const LEVELS = ['', '입문', '중급', '고급'];

export function ScenarioList({ scenarios, progress, onSelect, onResetProgress, recordsOnly = false, onExplore, onOpenRecords }: ScenarioListProps) {
  const headingId = useId();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [confirmReset, setConfirmReset] = useState(false);
  const libraryRef = useRef<HTMLElement>(null);
  /** 캠퍼스에서 방을 고르면 그 분류만 보이게 걸러 실습 목록으로 내려간다. */
  function enterRoom(next: Category) {
    setCategory(next); setQuery(''); setDifficulty('all');
    requestAnimationFrame(() => libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  const cleared = scenarios.filter(s => progress[s.id]?.cleared);
  const next = scenarios.find(s => !progress[s.id]?.cleared) ?? scenarios[0];
  const visible = scenarios.filter(s => (!recordsOnly || progress[s.id]?.cleared)
    && (category === 'all' || s.category === category)
    && (difficulty === 'all' || s.difficulty === Number(difficulty))
    && `${s.title} ${CATEGORIES[s.category].label} ${s.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const best = Math.max(0, ...cleared.map(s => progress[s.id].bestScore));

  return <div className="scenario-screen">
    <div className="page-heading">
      <div><div className="eyebrow">{recordsOnly ? 'YOUR LEARNING JOURNEY' : 'INCIDENT RESPONSE LAB'}</div>
        <h1>{recordsOnly ? '쌓이는 경험, 단단해지는 실력.' : '장애는 여기서, 경험은 실전처럼.'}</h1>
        <p className="muted">{recordsOnly ? '직접 해결한 장애와 최고 점수를 확인하세요.' : '안전한 가상 서버에서 원인을 찾고, 직접 복구하며 배우세요.'}</p>
      </div><span className="environment-label"><span className="status-dot" /> 실습 환경 준비됨</span>
    </div>
    {!recordsOnly && <section className="lab-hero">
      <div className="hero-copy"><span className="hero-kicker"><span /> YOUR NEXT ON-CALL STARTS HERE</span>
        <h2>서버에 문제가 생겼습니다.<br /><span>당신의 첫 명령어는?</span></h2>
        <p>로그 속 단서를 따라 원인을 좁히고,<br />복구의 순간까지 직접 경험하는 인프라 실습.</p>
        <div className="hero-actions"><button className="primary" onClick={() => next && onSelect(next)}> {cleared.length ? '다음 실습 시작' : '첫 장애 해결하기'} <Icon name="arrow" size={17} /></button>
          <button className="text-button" onClick={onExplore}>지식 탐색 <Icon name="arrow" size={15} /></button></div>
        <div className="hero-note"><Icon name="shield" size={14} /> 실제 시스템에 영향 없는 가상 환경</div>
      </div><IsoCampus scenarios={scenarios} progress={progress} onEnterCategory={enterRoom} onOpenRecords={onOpenRecords} onExplore={onExplore} onOpenScenario={onSelect} />
    </section>}
    <section className="lab-stats" aria-label="내 학습 현황">
      <div className="lab-stat"><span className="stat-icon"><Icon name="server" /></span><div><span>실습 시나리오</span><strong>{String(scenarios.length).padStart(2, '0')} <small>개</small></strong></div><span className="stat-note">{OPEN_CATEGORIES.length}개 인프라 영역</span></div>
      <div className="lab-stat"><span className="stat-icon green"><Icon name="check" /></span><div><span>해결한 장애</span><strong>{String(cleared.length).padStart(2, '0')} <small>/ {scenarios.length}</small></strong></div><div className="mini-progress" aria-label={`완료율 ${Math.round(cleared.length / scenarios.length * 100)}%`}><i style={{ width: `${cleared.length / scenarios.length * 100}%` }} /></div></div>
      <div className="lab-stat"><span className="stat-icon amber"><Icon name="chart" /></span><div><span>나의 최고 점수</span><strong>{best || '—'} <small>점</small></strong></div><span className="stat-note">한 번의 실습, 하나의 성장</span></div>
    </section>
    <section className="scenario-library" aria-labelledby={headingId} ref={libraryRef}>
      <div className="library-heading"><div><h2 id={headingId}>{recordsOnly ? '해결한 시나리오' : '어떤 장애를 해결해 볼까요?'} <span>{visible.length}</span></h2><p className="muted small">{recordsOnly ? '다시 도전해서 기록을 갱신해 보세요.' : '증상 확인부터 재발 방지까지, 한 번에 하나씩.'}</p></div>
        <label className="scenario-search"><Icon name="search" size={17} /><input aria-label="시나리오 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="시나리오 검색..." /></label></div>
      <div className="filter-row"><div className="category-tabs" role="group" aria-label="시나리오 분류">
        <button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>전체 <span>{scenarios.length}</span></button>
        {OPEN_CATEGORIES.map(({ id, icon, label }) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}><Icon name={icon} size={15} />{label}</button>)}
      </div><select aria-label="난이도 필터" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">모든 난이도</option><option value="1">입문</option><option value="2">중급</option><option value="3">고급</option></select></div>
      <div className="scenario-grid">{visible.map((scenario, index) => {
        const info = CATEGORIES[scenario.category];
        const record = progress[scenario.id];
        return <button key={scenario.id} className={`scenario-card category-${scenario.category}`} onClick={() => onSelect(scenario)} style={{ '--card-index': index } as CSSProperties}>
          <div className="card-top"><span className="card-icon"><Icon name={info.icon} size={21} /></span><span className={`difficulty level-${scenario.difficulty}`}><i /><i /><i />{LEVELS[scenario.difficulty]}</span></div>
          <span className="card-category">{info.wallTag} <span>/ {String(scenarios.indexOf(scenario) + 1).padStart(2, '0')}</span></span>
          <h3>{scenario.title}</h3><p className="card-description">{scenario.ticket.split('\n').find(line => line.length > 25) ?? scenario.ticket.split('\n')[0]}</p>
          <div className="card-bottom"><span>{record?.cleared ? <><Icon name="check" size={14} /> 해결 완료 · {record.bestScore}점</> : <><span className="tiny-dot" /> {info.label} 실습</>}</span><span className="card-go"><Icon name="arrow" size={17} /></span></div>
        </button>;
      })}</div>
      {!visible.length && <div className="empty-state"><Icon name={recordsOnly ? 'chart' : 'search'} size={32} /><h3>{recordsOnly && !cleared.length ? '첫 번째 해결 기록을 기다리고 있어요' : '조건에 맞는 시나리오가 없습니다'}</h3><p className="muted">{recordsOnly && !cleared.length ? '가상 장애 실습을 완료하면 이곳에 기록이 쌓입니다.' : '검색어나 분류, 난이도를 변경해 보세요.'}</p><button onClick={() => { setQuery(''); setCategory('all'); setDifficulty('all'); if (recordsOnly && !cleared.length) onExplore(); }}>{recordsOnly && !cleared.length ? '지식 탐색으로 준비하기' : '필터 초기화'}</button></div>}
    </section>
    <footer className="lab-footer"><span><Icon name="shield" size={14} /> 모든 명령은 브라우저 안의 가상 환경에서 실행됩니다.</span>
      {cleared.length > 0 && <div>{confirmReset ? <><span>모든 학습 기록을 지울까요? </span><button className="small" onClick={() => { onResetProgress(); setConfirmReset(false); }}>기록 삭제</button> <button className="small" onClick={() => setConfirmReset(false)}>취소</button></> : <button className="text-button small" onClick={() => setConfirmReset(true)}>진행 기록 초기화</button>}</div>}
      <span className="footer-version">INFRACOACH / LAB v0.1</span>
    </footer>
  </div>;
}
