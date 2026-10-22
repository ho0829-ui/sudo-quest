import { lazy, Suspense, useEffect, useState } from 'react';
import { scenarios } from '../scenarios';
import type { Scenario } from '../engine/scenario/types';
import { createSession, isCleared, revealHint, submitCause, type Session } from '../engine/session/session';
import { calculateScore } from '../engine/session/score';
import { ScenarioList } from './screens/ScenarioList';
import { TicketScreen } from './screens/TicketScreen';
import { ReportScreen } from './screens/ReportScreen';
import { clearProgress, loadProgress, saveClear, type Progress } from './storage';
import { BackendStatus } from './components/BackendStatus';
import { KnowledgeScreen } from './screens/KnowledgeScreen';
import { Icon } from './components/Icon';
import { Rail, type Workspace } from './components/Rail';
import { CampusDefs } from './campus/RoomVignette';
import { formatRoute, parseRoute, type Route } from './route';
import { readSavedSession, saveActiveSession } from './sessionStore';
import './styles.css';
import './command-center.css';
import './coach.css';
import './game.css';
import { missionDraft } from './community/postFormat';

// 게시판 화면은 처음 들어갈 때 불러온다. 회고 양식(missionDraft)은 작은 순수 함수라 바로 가져온다.
const CommunityScreen = lazy(() => import('./community/CommunityScreen').then(m => ({ default: m.CommunityScreen })));
// 실습 화면(터미널·코치)과 명령 실행 엔진은 실습에 들어갈 때 불러온다. 홈 첫 화면을 가볍게 하려는 분할이다.
const PlayScreen = lazy(() => import('./screens/PlayScreen').then(m => ({ default: m.PlayScreen })));

/**
 * 화면은 주소(해시 라우트)에서 정해진다. 이동할 때 브라우저 기록에 쌓아 두므로
 * 뒤로/앞으로 가기가 화면 사이를 오간다. 진행 중 실습은 탭 저장소에 보관해 새로고침이나
 * 외부 링크에서 돌아와도 이어진다(sessionStore.ts).
 */
export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash, scenarios.length));
  const [knowledgeVisited, setKnowledgeVisited] = useState(route.kind === 'knowledge');
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [session, setSession] = useState<Session | null>(null);
  // 새로고침 전 실습이 있으면 엔진을 불러와 입력을 다시 실행한다. 끝나기 전에는 저장·주소 보정을 멈춘다.
  const [restoring, setRestoring] = useState(() => readSavedSession() !== null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  const workspace: Workspace = route.kind === 'community' ? 'community' : route.kind === 'knowledge' ? 'knowledge' : route.kind === 'records' ? 'records' : 'game';
  const scenario = route.kind === 'mission' ? scenarios[route.no - 1] : null;
  const ownSession = session && scenario && session.scenario === scenario ? session : null;
  const stage = route.kind === 'mission' ? route.stage : null;

  function go(next: Route, replace = false) {
    const url = formatRoute(next);
    if (replace) window.history.replaceState(null, '', url);
    else if (window.location.hash !== url) window.history.pushState(null, '', url);
    if (next.kind === 'knowledge') setKnowledgeVisited(true);
    setRoute(next);
  }

  // 뒤로/앞으로 가기. "#main-content" 같은 본문 이동 주소는 화면 이동이 아니므로 무시한다.
  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash;
      if (hash !== '' && !hash.startsWith('#/')) return;
      const next = parseRoute(hash, scenarios.length);
      if (next.kind === 'knowledge') setKnowledgeVisited(true);
      setRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const saved = readSavedSession();
    if (!saved) return;
    let cancelled = false;
    import('./sessionReplay')
      .then(({ restoreSession }) => { if (!cancelled) setSession(restoreSession(saved, scenarios)); })
      .catch(() => { /* 조각을 못 받으면 새 실습으로 시작한다 */ })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, []);
  // 복원 중에 빈 세션을 저장하면 저장본이 지워지므로, 복원이 끝난 뒤부터 저장한다.
  useEffect(() => { if (!restoring) saveActiveSession(session); }, [session, restoring]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [route]);

  // 주소는 실습 중인데 그 실습의 세션이 없으면(직접 입력·오래된 기록) 브리핑으로 돌려보낸다.
  useEffect(() => {
    if (restoring || route.kind !== 'mission' || route.stage === 'briefing') return;
    const ready = route.stage === 'play' ? ownSession : ownSession && isCleared(ownSession) ? ownSession : null;
    if (!ready) go({ ...route, stage: 'briefing' }, true);
  }, [route, ownSession, restoring]);

  useEffect(() => {
    if (!ownSession || stage !== 'play' || !isCleared(ownSession) || route.kind !== 'mission') return;
    setProgress(saveClear(ownSession.scenario.id, calculateScore(ownSession).total));
    // 클리어한 실습 화면 기록을 리포트로 바꿔 끼운다. 그래야 뒤로 가기가 다시 리포트로 튕기지 않는다.
    go({ ...route, stage: 'report' }, true);
  }, [ownSession, stage]);

  const missionNo = (s: Scenario) => scenarios.indexOf(s) + 1;
  function navigate(next: Workspace) {
    go(next === 'community' ? { kind: 'community' } : next === 'knowledge' ? { kind: 'knowledge' } : next === 'records' ? { kind: 'records' } : { kind: 'home' });
  }
  function startScenario(selected: Scenario) {
    go({ kind: 'mission', no: missionNo(selected), stage: 'briefing' });
  }
  /** 같은 실습을 하던 중이면 이어서, 아니면 새로 시작한다. */
  function beginInvestigation(fresh = false) {
    if (!scenario) return;
    if (fresh || !ownSession || isCleared(ownSession)) setSession(createSession(scenario));
    go({ kind: 'mission', no: missionNo(scenario), stage: 'play' });
  }
  function backToList() {
    setSession(null); go({ kind: 'home' });
  }
  /** 어디서든 홈(실습 목록)으로. 명령을 실행한 실습 중이면 기록이 사라지므로 한 번 묻는다. */
  function goHome() {
    const leaving = stage === 'play' && ownSession && ownSession.commands.length > 0;
    if (leaving && !window.confirm('진행 중인 실습을 나가면 이번 기록이 사라집니다. 홈으로 갈까요?')) return;
    backToList();
  }

  return <div className={`control-center ${motion ? '' : 'motion-paused'}`}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>본문으로 건너뛰기</a>
    <CampusDefs />
    <Rail workspace={workspace} scenarios={scenarios} progress={progress} onNavigate={navigate} onHome={goHome} />
    <div className="workspace-body">
      <header className="topbar"><div className="crumbs"><button className="home-crumb" onClick={goHome} aria-label="홈으로"><Icon name="home" size={14} /><span>홈</span></button><span className="breadcrumb-slash">/</span><strong>{workspace === 'community' ? '커뮤니티 카페' : workspace === 'knowledge' ? '지식 탐색' : workspace === 'records' ? '학습 기록' : '가상 장애 실습'}</strong></div><div className="topbar-actions"><span className="sandbox-label"><Icon name="shield" size={14} /> SANDBOX MODE</span><button className="motion-button" onClick={() => setMotion(value => !value)} aria-label={motion ? '화면 애니메이션 일시정지' : '화면 애니메이션 재생'} aria-pressed={!motion}><Icon name={motion ? 'pause' : 'play'} size={15} /><span>{motion ? '모션 켜짐' : '모션 꺼짐'}</span></button></div></header>
      <main className="app" id="main-content" tabIndex={-1}>
        <BackendStatus />
        {route.kind === 'community' && <Suspense fallback={<p role="status">카페 문을 여는 중…</p>}><CommunityScreen postId={route.postId} writing={!!route.write}
          preset={route.mission ? missionDraft(route.mission, scenarios[route.mission - 1].title) : undefined}
          onOpen={postId => go({ kind: 'community', postId })} onWrite={() => go({ kind: 'community', write: true })}
          onCreated={postId => go({ kind: 'community', postId }, true)} /></Suspense>}
        {knowledgeVisited && <div hidden={workspace !== 'knowledge'}><KnowledgeScreen /></div>}
        {workspace === 'records' && <ScenarioList key="records" scenarios={scenarios} progress={progress} onSelect={startScenario} onResetProgress={() => setProgress(clearProgress())} recordsOnly onExplore={() => navigate('knowledge')} onOpenRecords={() => navigate('records')} onCommunity={() => navigate('community')} />}
        <div hidden={workspace !== 'game'}>
          {scenario && <div className="session-breadcrumb"><button className="text-button small" onClick={backToList}>← 시나리오 목록</button><span className="small muted">{scenario.title}</span></div>}
          {route.kind === 'home' && <ScenarioList scenarios={scenarios} progress={progress} onSelect={startScenario} onResetProgress={() => setProgress(clearProgress())} onExplore={() => navigate('knowledge')} onOpenRecords={() => navigate('records')} onCommunity={() => navigate('community')} />}
          {stage === 'briefing' && scenario && <TicketScreen scenario={scenario} resumable={!!ownSession && !isCleared(ownSession)} onStart={() => beginInvestigation()} onBack={backToList} />}
          {restoring && stage !== 'briefing' && <p role="status" className="small muted">진행 중이던 실습을 이어서 불러오는 중…</p>}
          {stage === 'play' && ownSession && <Suspense fallback={<p role="status" className="small muted">실습 터미널을 준비하는 중…</p>}><PlayScreen session={ownSession}
            onUpdate={change => setSession(current => current ? change(current) : current)}
            onRevealHint={() => setSession(current => current ? revealHint(current) : current)}
            onSubmitCause={choiceId => { const result = submitCause(ownSession, choiceId); setSession(result.session); return { correct: result.correct, whyWrong: result.whyWrong }; }} onGiveUp={backToList} /></Suspense>}
          {stage === 'report' && ownSession && <ReportScreen session={ownSession} onBackToList={backToList} onRetry={() => beginInvestigation(true)}
            onShare={() => go({ kind: 'community', write: true, mission: missionNo(ownSession.scenario) })} />}
        </div>
      </main>
    </div>
  </div>;
}
