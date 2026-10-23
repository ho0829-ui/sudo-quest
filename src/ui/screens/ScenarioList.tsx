import { useId, useRef, useState, type CSSProperties } from 'react';
import type { Scenario, Category } from '../../engine/scenario/types';
import type { Progress } from '../storage';
import { Icon } from '../components/Icon';
import { CATEGORIES, OPEN_CATEGORIES } from '../categories';
import { IsoCampus } from '../campus/IsoCampus';
import { upcomingScenarios } from '../../scenarios/upcoming';
import { nextMission } from '../nextMission';
import { THEMES } from '../campus/themes';

interface ScenarioListProps {
  scenarios: Scenario[];
  progress: Progress;
  onSelect: (scenario: Scenario) => void;
  onResetProgress: () => void;
  recordsOnly?: boolean;
  onExplore: () => void;
  onOpenRecords: () => void;
  onCommunity: () => void;
  /** 모든 실습을 해결했을 때 피날레·엔딩 크레딧 열기 */
  onFinale?: () => void;
  onCredits?: () => void;
  /** 튜토리얼 연습 실습 열기(홈에서만). 끝냈으면 버튼 이름이 "다시 보기"로 바뀐다. */
  onTutorial?: () => void;
  tutorialDone?: boolean;
  /** 테스트용 임시 클리어 상태에서는 재입장할 때 피날레를 자동으로 다시 열지 않는다. */
  previewAllClear?: boolean;
}
const LEVELS = ['', '입문', '중급', '고급'];

export function ScenarioList({ scenarios, progress, onSelect, onResetProgress, recordsOnly = false, onExplore, onOpenRecords, onCommunity, onFinale, onCredits, onTutorial, tutorialDone, previewAllClear = false }: ScenarioListProps) {
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
  // 이미 해결한 실습으로 보내지 않는다(모두 해결했으면 '기록 갱신'으로 바뀐다). nextMission.ts 참고.
  const next = nextMission(scenarios, progress);
  const visible = scenarios.filter(s => (!recordsOnly || progress[s.id]?.cleared)
    && (category === 'all' || s.category === category)
    && (difficulty === 'all' || s.difficulty === Number(difficulty))
    && `${s.title} ${CATEGORIES[s.category].label} ${s.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const best = Math.max(0, ...cleared.map(s => progress[s.id].bestScore));
  // 오픈 예정 실습은 난이도가 아직 없으므로 난이도를 고르면 숨긴다. 기록 화면에는 보이지 않는다.
  const upcoming = recordsOnly || difficulty !== 'all' ? [] : upcomingScenarios.filter(u => (category === 'all' || u.category === category)
    && `${u.title} ${CATEGORIES[u.category].label}`.toLowerCase().includes(query.trim().toLowerCase()));

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
        <div className="hero-actions"><button className="primary" onClick={() => next && onSelect(next.scenario)}> {next?.label ?? '첫 장애 해결하기'} <Icon name="arrow" size={17} /></button>
          {onTutorial && <button className="text-button tutorial-button" onClick={onTutorial}>{tutorialDone ? '튜토리얼 다시 보기' : '처음이라면 · 5분 튜토리얼'} <Icon name="arrow" size={15} /></button>}
          <button className="text-button" onClick={onExplore}>지식 탐색 <Icon name="arrow" size={15} /></button></div>
        <div className="hero-note"><Icon name="shield" size={14} /> 실제 시스템에 영향 없는 가상 환경</div>
      </div><IsoCampus scenarios={scenarios} progress={progress} onEnterCategory={enterRoom} onOpenRecords={onOpenRecords} onExplore={onExplore} onOpenScenario={onSelect} onCommunity={onCommunity} onFinale={onFinale} onCredits={onCredits} suppressAutoFinale={previewAllClear} />
    </section>}
    {recordsOnly && scenarios.length > 0 && cleared.length === scenarios.length && onFinale && <section className="allclear-banner" aria-label="모든 장애 해결">
      <div><strong>🎆 ALL CLEAR — 모든 장애를 해결했어요!</strong><p className="muted small">축하 화면과 엔딩 크레딧을 언제든 다시 볼 수 있어요.</p></div>
      <div className="allclear-actions"><button className="primary" onClick={onFinale}>피날레 다시 보기</button><button onClick={onCredits}>엔딩 크레딧</button></div>
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
        {OPEN_CATEGORIES.map(({ id, icon, label }) => <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)} style={{ '--cat': THEMES[id].accent } as CSSProperties}><Icon name={icon} size={15} />{label}</button>)}
      </div><select aria-label="난이도 필터" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">모든 난이도</option><option value="1">입문</option><option value="2">중급</option><option value="3">고급</option></select></div>
      <div className="scenario-grid">{visible.map((scenario, index) => {
        const info = CATEGORIES[scenario.category];
        const record = progress[scenario.id];
        // 분류마다 캠퍼스 운영실과 같은 색(--cat)으로 아이콘·태그를 칠해 한눈에 구분되게 한다.
        return <button key={scenario.id} className={`scenario-card category-${scenario.category}${record?.cleared ? ' is-cleared' : ''}`} onClick={() => onSelect(scenario)} style={{ '--card-index': index, '--cat': THEMES[scenario.category].accent } as CSSProperties}>
          <div className="card-top"><span className="card-icon"><Icon name={info.icon} size={21} /></span><span className={`difficulty level-${scenario.difficulty}`}><i /><i /><i />{LEVELS[scenario.difficulty]}</span></div>
          <span className="card-category">{info.wallTag} <span>/ {String(scenarios.indexOf(scenario) + 1).padStart(2, '0')}</span></span>
          <h3>{scenario.title}</h3><p className="card-description">{scenario.ticket.split('\n').find(line => line.length > 25) ?? scenario.ticket.split('\n')[0]}</p>
          <div className="card-bottom">{record?.cleared
            ? <span className="card-cleared"><span className="card-cleared-badge"><Icon name="check" size={13} /> 해결 완료</span><span className="card-score" aria-label={`최고 점수 ${record.bestScore}점`}>{record.bestScore}<small>점</small></span></span>
            : <span><span className="tiny-dot" /> {info.label} 실습</span>}<span className="card-go"><Icon name="arrow" size={17} /></span></div>
        </button>;
      })}
      {upcoming.map((item, index) => <div key={item.title} className={`scenario-card upcoming category-${item.category}`} style={{ '--card-index': visible.length + index, '--cat': THEMES[item.category].accent } as CSSProperties}>
        <div className="card-top"><span className="card-icon"><Icon name={CATEGORIES[item.category].icon} size={21} /></span><span className="upcoming-badge">OPENING SOON</span></div>
        <span className="card-category">{CATEGORIES[item.category].wallTag} <span>/ 준비 중</span></span>
        <h3>{item.title}</h3><p className="card-description">{item.teaser}</p>
        <div className="card-bottom"><span><span className="tiny-dot" /> 다음 업데이트에 열려요</span></div>
      </div>)}</div>
      {!visible.length && !upcoming.length && <div className="empty-state"><Icon name={recordsOnly ? 'chart' : 'search'} size={32} /><h3>{recordsOnly && !cleared.length ? '첫 번째 해결 기록을 기다리고 있어요' : '조건에 맞는 시나리오가 없습니다'}</h3><p className="muted">{recordsOnly && !cleared.length ? '가상 장애 실습을 완료하면 이곳에 기록이 쌓입니다.' : '검색어나 분류, 난이도를 변경해 보세요.'}</p><button onClick={() => { setQuery(''); setCategory('all'); setDifficulty('all'); if (recordsOnly && !cleared.length) onExplore(); }}>{recordsOnly && !cleared.length ? '지식 탐색으로 준비하기' : '필터 초기화'}</button></div>}
    </section>
    <footer className="lab-footer"><span><Icon name="shield" size={14} /> 모든 명령은 브라우저 안의 가상 환경에서 실행됩니다.</span>
      {cleared.length > 0 && !previewAllClear && <div>{confirmReset ? <><span>모든 학습 기록을 지울까요? </span><button className="small" onClick={() => { onResetProgress(); setConfirmReset(false); }}>기록 삭제</button> <button className="small" onClick={() => setConfirmReset(false)}>취소</button></> : <button className="text-button small" onClick={() => setConfirmReset(true)}>진행 기록 초기화</button>}</div>}
      <span className="footer-version">INFRACOACH / LAB v0.1</span>
    </footer>
  </div>;
}
