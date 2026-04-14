import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useSessionStore } from '../stores/sessionStore';
import { parseApiError } from '../utils/parseApiError';
import { ERROR_MESSAGES } from '../utils/constants';
import { wsClient } from '../api/wsClient';
import { getRoleInfo, CARD_BACK_IMAGE } from '../utils/roles';
import NarratorScreen from '../components/game/NarratorScreen';
import NightActionScreen from '../components/game/NightActionScreen';
import NightWaitingScreen from '../components/game/NightWaitingScreen';
import DayDiscussionScreen from '../components/game/DayDiscussionScreen';
import DayVotingScreen from '../components/game/DayVotingScreen';
import FinaleScreen from '../components/game/FinaleScreen';
import RulesModal, { RulesButton } from '../components/game/RulesModal';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import './GamePage.scss';

function NightActionIcon({ action }: { action: string }) {
  if (action === 'kill' || action === 'maniac_kill') {
    return (
      <svg className="role-abilities__action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2l-5 5-2-2L2 10.5 13.5 22 19 16.5l-2-2 5-5z" />
      </svg>
    );
  }
  if (action === 'check' || action === 'don_check') {
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
  if (action === 'lover_visit') {
    return (
      <svg className="role-abilities__action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return null;
}

function actionLabel(action: string): string {
  if (action === 'kill') return 'Убийство';
  if (action === 'maniac_kill') return 'Убийство (маньяк)';
  if (action === 'check') return 'Проверка';
  if (action === 'don_check') return 'Проверка шерифа';
  if (action === 'heal') return 'Лечение';
  if (action === 'lover_visit') return 'Посещение';
  return '';
}

export default function GamePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const screen = useGameStore((s) => s.screen);
  const myRole = useGameStore((s) => s.myRole);
  const acknowledged = useGameStore((s) => s.acknowledged);
  const acknowledgedCount = useGameStore((s) => s.acknowledgedCount);
  const totalPlayers = useGameStore((s) => s.totalPlayers);
  const phase = useGameStore((s) => s.phase);
  const acknowledgeRoleAsync = useGameStore((s) => s.acknowledgeRole);

  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setTimerPaused = useSessionStore((s) => s.setTimerPaused);
  const roleRevealTimer = useSessionStore((s) => s.settings.role_reveal_timer_seconds);

  const [showRules, setShowRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game state + open WebSocket on mount.
  useEffect(() => {
    if (!sessionId) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await useGameStore.getState().loadState(sessionId);
        if (cancelled) return;
        // Сессия уже завершена (F5 после финала или игрок открыл ссылку на
        // закрытую сессию): у нас нет result для отрисовки финала — сразу
        // возвращаем пользователя на главную вместо тёмного экрана.
        const afterLoad = useGameStore.getState();
        if (afterLoad.screen === 'finale' && !afterLoad.result) {
          useGameStore.getState().reset();
          useSessionStore.getState().reset();
          navigate('/', { replace: true });
          return;
        }
        wsClient.connect(sessionId);
      } catch (err: any) {
        if (!cancelled) {
          const parsed = parseApiError(err);
          setLoadError(ERROR_MESSAGES[parsed.code as keyof typeof ERROR_MESSAGES] ?? parsed.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      wsClient.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Auto-flip card if already acknowledged (e.g. after page refresh).
  useEffect(() => {
    if (screen === 'role_reveal' && acknowledged && !flipped) {
      setFlipped(true);
      setShowAbilities(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, acknowledged]);

  // Role reveal timer — sync with backend timer_started_at.
  useEffect(() => {
    if (screen !== 'role_reveal') return;
    const timerSec = phase?.timer_seconds ?? roleRevealTimer;
    const startedAt = phase?.timer_started_at;
    if (!timerSec) { setTimeLeft(roleRevealTimer); return; }
    if (!startedAt) { setTimeLeft(timerSec); return; }
    const startedMs = Date.parse(startedAt);
    if (Number.isNaN(startedMs)) { setTimeLeft(timerSec); return; }
    const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
    setTimeLeft(Math.max(0, timerSec - elapsed));
  }, [screen, phase?.id, phase?.timer_seconds, phase?.timer_started_at, roleRevealTimer]);

  useEffect(() => {
    if (screen !== 'role_reveal') return;
    if (timeLeft <= 0 || timerPaused || acknowledged) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (!acknowledged) {
            acknowledgeRoleAsync().catch(() => {});
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, timeLeft, timerPaused, acknowledged]);

  const handleFlip = () => {
    if (!flipped) {
      setFlipped(true);
      setTimeout(() => setShowAbilities(true), 500);
    }
  };

  const handleAcknowledge = () => {
    acknowledgeRoleAsync().catch(() => {});
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="game-loading">
        <Loader size={48} />
      </div>
    );
  }

  if (loadError || !myRole) {
    return (
      <div className="game-error">
        <p>{loadError || 'Не удалось загрузить игру'}</p>
        <Button onClick={() => navigate('/', { replace: true })}>На главную</Button>
      </div>
    );
  }

  const roleInfo = getRoleInfo(myRole);
  const roleImage = roleInfo?.image ?? CARD_BACK_IMAGE;
  const roleDesc = roleInfo?.description ?? 'Роль без описания способностей.';
  const nightAction = myRole.abilities?.night_action;

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
                    <img src={CARD_BACK_IMAGE} alt="Card back" className="role-card__back-img" />
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
                  {nightAction && (
                    <div className="role-abilities__action">
                      <NightActionIcon action={nightAction} />
                      <span className="role-abilities__action-text">
                        Ночное действие: {actionLabel(nightAction)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="role-progress" aria-live="polite">
                <div className="role-progress__counter">
                  <span className="role-progress__count">{acknowledgedCount}</span>
                  <span className="role-progress__separator">/</span>
                  <span className="role-progress__total">{totalPlayers}</span>
                </div>
                <p className="role-progress__text">Ознакомились с ролями</p>
              </div>

              {flipped && !acknowledged && (
                <div className="role-acknowledge">
                  <Button onClick={handleAcknowledge}>Ознакомлен</Button>
                </div>
              )}

              {acknowledged && (
                <div className="role-waiting">
                  <p className="role-waiting__text">Ожидание остальных игроков...</p>
                  <Loader size={32} />
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
