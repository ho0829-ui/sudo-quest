import { useEffect, useState } from 'react';
import { scenarios } from '../scenarios';
import type { Scenario } from '../engine/scenario/types';
import { createSession, execute, isCleared, revealHint, submitCause, type Session } from '../engine/session/session';
import { calculateScore } from '../engine/session/score';
import { ScenarioList } from './screens/ScenarioList';
import { TicketScreen } from './screens/TicketScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ReportScreen } from './screens/ReportScreen';
import { clearProgress, loadProgress, saveClear, type Progress } from './storage';
import { BackendStatus } from './components/BackendStatus';
import { KnowledgeScreen } from './screens/KnowledgeScreen';
import { Icon } from './components/Icon';
import { Rail, type Workspace } from './components/Rail';
import { CampusDefs } from './campus/RoomVignette';
import './styles.css';
import './command-center.css';
import './coach.css';
import './game.css';

type Screen = 'list' | 'ticket' | 'play' | 'report';

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>('game');
  const [knowledgeVisited, setKnowledgeVisited] = useState(false);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [screen, setScreen] = useState<Screen>('list');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, workspace]);

  useEffect(() => {
    if (!session || screen !== 'play' || !isCleared(session)) return;
    setProgress(saveClear(session.scenario.id, calculateScore(session).total));
    setScreen('report');
  }, [session, screen]);

  function navigate(next: Workspace) {
    if (next === 'knowledge') setKnowledgeVisited(true);
    setWorkspace(next);
  }
  function startScenario(selected: Scenario) {
    setScenario(selected); setSession(null); setScreen('ticket'); setWorkspace('game');
  }
  function beginInvestigation() {
    if (!scenario) return;
    setSession(createSession(scenario)); setScreen('play');
  }
  function backToList() {
    setSession(null); setScenario(null); setScreen('list'); setWorkspace('game');
  }
  /** 어디서든 홈(실습 목록)으로. 명령을 실행한 실습 중이면 기록이 사라지므로 한 번 묻는다. */
  function goHome() {
    const leaving = workspace === 'game' && screen === 'play' && session && session.commands.length > 0;
    if (leaving && !window.confirm('진행 중인 실습을 나가면 이번 기록이 사라집니다. 홈으로 갈까요?')) return;
    backToList();
  }

  return <div className={`control-center ${motion ? '' : 'motion-paused'}`}>
    <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <CampusDefs />
    <Rail workspace={workspace} scenarios={scenarios} progress={progress} onNavigate={navigate} onHome={goHome} />
    <div className="workspace-body">
      <header className="topbar"><div className="crumbs"><button className="home-crumb" onClick={goHome} aria-label="홈으로"><Icon name="home" size={14} /><span>홈</span></button><span className="breadcrumb-slash">/</span><strong>{workspace === 'knowledge' ? '지식 탐색' : workspace === 'records' ? '학습 기록' : '가상 장애 실습'}</strong></div><div className="topbar-actions"><span className="sandbox-label"><Icon name="shield" size={14} /> SANDBOX MODE</span><button className="motion-button" onClick={() => setMotion(value => !value)} aria-label={motion ? '화면 애니메이션 일시정지' : '화면 애니메이션 재생'} aria-pressed={!motion}><Icon name={motion ? 'pause' : 'play'} size={15} /><span>{motion ? '모션 켜짐' : '모션 꺼짐'}</span></button></div></header>
      <main className="app" id="main-content">
        <BackendStatus />
        {knowledgeVisited && <div hidden={workspace !== 'knowledge'}><KnowledgeScreen /></div>}
        {workspace === 'records' && <ScenarioList key="records" scenarios={scenarios} progress={progress} onSelect={startScenario} onResetProgress={() => setProgress(clearProgress())} recordsOnly onExplore={() => navigate('knowledge')} onOpenRecords={() => navigate('records')} />}
        <div hidden={workspace !== 'game'}>
          {screen !== 'list' && <div className="session-breadcrumb"><button className="text-button small" onClick={backToList}>← 시나리오 목록</button><span className="small muted">{scenario?.title}</span></div>}
          {screen === 'list' && <ScenarioList scenarios={scenarios} progress={progress} onSelect={startScenario} onResetProgress={() => setProgress(clearProgress())} onExplore={() => navigate('knowledge')} onOpenRecords={() => navigate('records')} />}
          {screen === 'ticket' && scenario && <TicketScreen scenario={scenario} onStart={beginInvestigation} onBack={backToList} />}
          {screen === 'play' && session && <PlayScreen session={session}
            onCommand={input => setSession(current => current ? execute(current, input) : current)}
            onRevealHint={() => setSession(current => current ? revealHint(current) : current)}
            onSubmitCause={choiceId => { const result = submitCause(session, choiceId); setSession(result.session); return { correct: result.correct, whyWrong: result.whyWrong }; }} onGiveUp={backToList} />}
          {screen === 'report' && session && <ReportScreen session={session} onBackToList={backToList} onRetry={beginInvestigation} />}
        </div>
      </main>
    </div>
  </div>;
}
