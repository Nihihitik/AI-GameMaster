import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import { useSessionStore } from '../stores/sessionStore';
import { roleImages, roleDescriptions, cardBackImage } from '../mocks/gameMocks';
import './RoleRevealPage.scss';

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

export default function RoleRevealPage() {
  const navigate = useNavigate();
  const [flipped, setFlipped] = useState(false);
  const [showAbilities, setShowAbilities] = useState(false);
  const [allReady, setAllReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const myRole = useSessionStore((s) => s.myRole);
  const acknowledged = useSessionStore((s) => s.acknowledged);
  const acknowledgedCount = useSessionStore((s) => s.acknowledgedCount);
  const totalPlayers = useSessionStore((s) => s.totalPlayers);
  const settings = useSessionStore((s) => s.settings);
  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setTimerPaused = useSessionStore((s) => s.setTimerPaused);
  const acknowledgeRole = useSessionStore((s) => s.acknowledgeRole);
  const addAcknowledgment = useSessionStore((s) => s.addAcknowledgment);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!myRole) {
      navigate('/', { replace: true });
      return;
    }
    setTimeLeft(settings.role_reveal_timer_seconds);
  }, [myRole, navigate, settings.role_reveal_timer_seconds]);

  useEffect(() => {
    if (timeLeft <= 0 || timerPaused || acknowledged) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (!acknowledged) acknowledgeRole();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, timerPaused, acknowledged]);

  useEffect(() => {
    if (acknowledged && totalPlayers > 0) {
      const remaining = totalPlayers - acknowledgedCount;
      if (remaining > 0) {
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < remaining; i++) {
          timers.push(
            setTimeout(() => {
              addAcknowledgment();
            }, (i + 1) * 1500)
          );
        }
        return () => timers.forEach(clearTimeout);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acknowledged]);

  useEffect(() => {
    if (acknowledgedCount >= totalPlayers && totalPlayers > 0 && acknowledged) {
      const timer = setTimeout(() => {
        setAllReady(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [acknowledgedCount, totalPlayers, acknowledged]);

  const handleFlip = () => {
    if (!flipped) {
      setFlipped(true);
      setTimeout(() => setShowAbilities(true), 500);
    }
  };

  const handleAcknowledge = () => {
    acknowledgeRole();
  };

  const togglePause = useCallback(() => {
    setTimerPaused(!timerPaused);
  }, [timerPaused, setTimerPaused]);

  if (!myRole) return null;

  const roleName = myRole.name;
  const roleImage = roleImages[roleName] || cardBackImage;
  const roleDesc = roleDescriptions[roleName] || 'Роль без описания способностей.';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`role-page ${!flipped ? 'role-page--preflip' : ''}`}>
      <header className="role-header">
        <button className="role-header__pause" onClick={togglePause}>
          {timerPaused ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          )}
        </button>
        <h1 className="role-header__title">Ваша роль</h1>
        <div className={`role-header__timer-display ${timeLeft <= 5 ? 'role-header__timer-display--danger' : ''}`}>
          {formatTime(timeLeft)}
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
            {myRole.abilities?.night_action && (
              <div className="role-abilities__action">
                <NightActionIcon action={myRole.abilities.night_action} />
                <span className="role-abilities__action-text">
                  Ночное действие: {
                    myRole.abilities.night_action === 'kill' ? 'Убийство' :
                    myRole.abilities.night_action === 'check' ? 'Проверка' :
                    'Лечение'
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {flipped && !acknowledged && (
          <div className="role-acknowledge">
            <Button onClick={handleAcknowledge}>Ознакомлен</Button>
          </div>
        )}

        {acknowledged && !allReady && (
          <div className="role-waiting">
            <div className="role-waiting__counter">
              <span className="role-waiting__count">{acknowledgedCount}</span>
              <span className="role-waiting__separator">/</span>
              <span className="role-waiting__total">{totalPlayers}</span>
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
}
