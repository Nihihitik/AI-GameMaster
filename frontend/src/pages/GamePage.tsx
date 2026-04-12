import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useSessionStore } from '../stores/sessionStore';
import { startGameCycle, beginNightSequence, cleanupEngine } from '../mocks/mockGameEngine';
import { roleImages, roleDescriptions, cardBackImage, mockRoles } from '../mocks/gameMocks';
import NarratorScreen from '../components/game/NarratorScreen';
import NightActionScreen from '../components/game/NightActionScreen';
import NightWaitingScreen from '../components/game/NightWaitingScreen';
import DayDiscussionScreen from '../components/game/DayDiscussionScreen';
import DayVotingScreen from '../components/game/DayVotingScreen';
import FinaleScreen from '../components/game/FinaleScreen';
import RulesModal, { RulesButton } from '../components/game/RulesModal';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import { Player, Role } from '../types/game';
import './GamePage.scss';

function getRoleSlug(role: Role): string {
  const map: Record<string, string> = {
    'Мафия': 'mafia',
    'Дон Мафии': 'don',
    'Шериф': 'sheriff',
    'Доктор': 'doctor',
    'Мирный житель': 'civilian',
    'Любовница': 'lover',
    'Маньяк': 'maniac',
  };
  return map[role.name] || 'civilian';
}

function NightActionIcon({ action }: { action: string }) {
  if (action === 'kill') {
    return (
      <svg className="role-abilities__action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2l-5 5-2-2L2 10.5 13.5 22 19 16.5l-2-2 5-5z" />
      </svg>
    );
  }
  if (action === 'check') {
    return (
      <svg className="role-abilities__action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  }
  if (action === 'heal') {
    return (
      <svg className="role-abilities__action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }
  return null;
}

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const screen = useGameStore((s) => s.screen);

  const sessionMyRole = useSessionStore((s) => s.myRole);
  const sessionPlayers = useSessionStore((s) => s.players);
  const sessionSettings = useSessionStore((s) => s.settings);
  const sessionAcknowledged = useSessionStore((s) => s.acknowledged);
  const sessionAcknowledgedCount = useSessionStore((s) => s.acknowledgedCount);
  const sessionTotalPlayers = useSessionStore((s) => s.totalPlayers);
  const sessionMyPlayerId = useSessionStore((s) => s.myPlayerId);
  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setTimerPaused = useSessionStore((s) => s.setTimerPaused);
  const acknowledgeRole = useSessionStore((s) => s.acknowledgeRole);
  const addAcknowledgment = useSessionStore((s) => s.addAcknowledgment);

  const [showRules, setShowRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameInitialized, setGameInitialized] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize game store from session store
  useEffect(() => {
    if (!sessionMyRole || !sessionPlayers.length || gameInitialized) return;

    const gameStore = useGameStore.getState();
    gameStore.setSessionId(sessionId || '');
    gameStore.setMyPlayerId(sessionMyPlayerId || '');
    gameStore.setMyRole(sessionMyRole);
    gameStore.setTotalPlayers(sessionPlayers.length);

    // Build players for game
    const gamePlayers: Player[] = sessionPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      status: 'alive' as const,
      join_order: p.join_order,
    }));
    gameStore.setPlayers(gamePlayers);

    // Assign roles to all players (mock)
    const roleConfig = sessionSettings.role_config;
    const roleList: string[] = [];
    for (let i = 0; i < roleConfig.mafia; i++) roleList.push('mafia');
    for (let i = 0; i < roleConfig.don; i++) roleList.push('don');
    for (let i = 0; i < roleConfig.sheriff; i++) roleList.push('sheriff');
    for (let i = 0; i < roleConfig.doctor; i++) roleList.push('doctor');
    for (let i = 0; i < roleConfig.lover; i++) roleList.push('lover');
    for (let i = 0; i < roleConfig.maniac; i++) roleList.push('maniac');
    while (roleList.length < sessionPlayers.length) roleList.push('civilian');
    const shuffled = roleList.sort(() => Math.random() - 0.5);

    const assignment: Record<string, Role> = {};
    const activeRolesSet = new Set<string>();
    sessionPlayers.forEach((p, i) => {
      const slug = shuffled[i];
      const role = mockRoles[slug] || mockRoles.civilian;
      if (p.id === sessionMyPlayerId) {
        assignment[p.id] = sessionMyRole;
        activeRolesSet.add(getRoleSlug(sessionMyRole));
      } else {
        assignment[p.id] = role;
        activeRolesSet.add(slug);
      }
    });

    gameStore.setAllRolesAssignment(assignment);
    gameStore.setActiveRoles(Array.from(activeRolesSet));
    gameStore.setScreen('role_reveal');

    setTimeLeft(sessionSettings.role_reveal_timer_seconds);
    setGameInitialized(true);

    return () => {
      cleanupEngine();
    };
  }, [sessionMyRole, sessionPlayers, sessionSettings, sessionMyPlayerId, sessionId, gameInitialized]);

  // Role reveal timer
  useEffect(() => {
    if (screen !== 'role_reveal') return;
    if (timeLeft <= 0 || timerPaused || sessionAcknowledged) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (!sessionAcknowledged) acknowledgeRole();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, timeLeft, timerPaused, sessionAcknowledged]);

  // Simulate other acknowledgments
  useEffect(() => {
    if (screen !== 'role_reveal') return;
    if (sessionAcknowledged && sessionTotalPlayers > 0) {
      const remaining = sessionTotalPlayers - sessionAcknowledgedCount;
      if (remaining > 0) {
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < remaining; i++) {
          timers.push(setTimeout(() => addAcknowledgment(), (i + 1) * 1200));
        }
        return () => timers.forEach(clearTimeout);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAcknowledged, screen]);

  // All acknowledged → transition to game
  useEffect(() => {
    if (screen !== 'role_reveal') return;
    if (sessionAcknowledgedCount >= sessionTotalPlayers && sessionTotalPlayers > 0 && sessionAcknowledged) {
      const timer = setTimeout(() => setAllReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [sessionAcknowledgedCount, sessionTotalPlayers, sessionAcknowledged, screen]);

  // After allReady, start game cycle
  useEffect(() => {
    if (!allReady) return;
    const timer = setTimeout(() => {
      startGameCycle();
    }, 2000);
    return () => clearTimeout(timer);
  }, [allReady]);

  // When narrator finishes and pendingScreen is night_waiting, start night sequence
  useEffect(() => {
    if (screen === 'night_waiting') {
      const timer = setTimeout(() => {
        beginNightSequence();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // When narrator finishes and goes to night_action, nothing to do (user sees action screen)
  // When narrator finishes and goes to day_discussion, the discussion screen handles itself

  const handleFlip = () => {
    if (!flipped) {
      setFlipped(true);
      setTimeout(() => setShowAbilities(true), 500);
    }
  };

  const handleAcknowledge = () => {
    acknowledgeRole();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!sessionMyRole) {
    navigate('/', { replace: true });
    return null;
  }

  const roleName = sessionMyRole.name;
  const roleImage = roleImages[roleName] || cardBackImage;
  const roleDesc = roleDescriptions[roleName] || 'Роль без описания способностей.';

  // Render based on current screen
  const renderScreen = () => {
    switch (screen) {
      case 'role_reveal':
        return (
          <div className={`role-page ${!flipped ? 'role-page--preflip' : ''}`}>
            <header className="role-header">
              <button className="role-header__pause" onClick={() => setTimerPaused(!timerPaused)}>
                {timerPaused ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                )}
              </button>
              <h1 className="role-header__title">Ваша роль</h1>
              <div className="game-header-right">
                <RulesButton onClick={() => setShowRules(true)} />
                <div className={`role-header__timer-display ${timeLeft <= 5 ? 'role-header__timer-display--danger' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </header>

            <main className="role-main">
              <div className={`role-card ${flipped ? 'role-card--flipped' : ''}`} onClick={handleFlip}>
                <div className="role-card__inner">
                  <div className="role-card__back">
                    <img src={cardBackImage} alt="Card back" className="role-card__back-img" />
                  </div>
                  <div className="role-card__front">
                    <img src={roleImage} alt="Role" className="role-card__front-img" />
                  </div>
                </div>
              </div>
              {!flipped && (
                <p className="role-tap-hint">Нажмите на карточку, чтобы узнать роль</p>
              )}

              <div className={`role-abilities ${showAbilities ? 'role-abilities--visible' : ''}`}>
                <div className="role-abilities__card">
                  <h3 className="role-abilities__title">Способности</h3>
                  <p className="role-abilities__text">{roleDesc}</p>
                  {sessionMyRole.abilities?.night_action && (
                    <div className="role-abilities__action">
                      <NightActionIcon action={sessionMyRole.abilities.night_action} />
                      <span className="role-abilities__action-text">
                        Ночное действие: {
                          sessionMyRole.abilities.night_action === 'kill' ? 'Убийство' :
                          sessionMyRole.abilities.night_action === 'check' ? 'Проверка' :
                          'Лечение'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {flipped && !sessionAcknowledged && (
                <div className="role-acknowledge">
                  <Button onClick={handleAcknowledge}>Ознакомлен</Button>
                </div>
              )}

              {sessionAcknowledged && !allReady && (
                <div className="role-waiting">
                  <div className="role-waiting__counter">
                    <span className="role-waiting__count">{sessionAcknowledgedCount}</span>
                    <span className="role-waiting__separator">/</span>
                    <span className="role-waiting__total">{sessionTotalPlayers}</span>
                  </div>
                  <p className="role-waiting__text">Ожидание остальных игроков...</p>
                  <Loader size={32} />
                </div>
              )}

              {allReady && (
                <div className="role-all-ready">
                  <div className="role-all-ready__check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="role-all-ready__text">Все игроки ознакомились с ролями!</p>
                  <p className="role-all-ready__hint">Игра скоро начнётся...</p>
                </div>
              )}
            </main>
          </div>
        );

      case 'narrator':
        return (
          <div className="game-screen-wrapper">
            <div className="game-screen-header">
              <RulesButton onClick={() => setShowRules(true)} />
            </div>
            <NarratorScreen />
          </div>
        );

      case 'night_action':
        return (
          <div className="game-screen-wrapper">
            <div className="game-screen-header">
              <RulesButton onClick={() => setShowRules(true)} />
            </div>
            <NightActionScreen />
          </div>
        );

      case 'night_waiting':
        return (
          <div className="game-screen-wrapper">
            <div className="game-screen-header">
              <RulesButton onClick={() => setShowRules(true)} />
            </div>
            <NightWaitingScreen />
          </div>
        );

      case 'day_discussion':
        return (
          <div className="game-screen-wrapper">
            <div className="game-screen-header">
              <RulesButton onClick={() => setShowRules(true)} />
            </div>
            <DayDiscussionScreen />
          </div>
        );

      case 'day_voting':
        return (
          <div className="game-screen-wrapper">
            <div className="game-screen-header">
              <RulesButton onClick={() => setShowRules(true)} />
            </div>
            <DayVotingScreen />
          </div>
        );

      case 'finale':
        return (
          <div className="game-screen-wrapper">
            <FinaleScreen />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {renderScreen()}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />
    </>
  );
}
