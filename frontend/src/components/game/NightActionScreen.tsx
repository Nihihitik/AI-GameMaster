import React, { useState, useEffect, useRef } from 'react';
import { useGameStore, CheckResultEntry } from '../../stores/gameStore';
import { submitNightAction, skipMafiaKill, advanceNightAction } from '../../mocks/mockGameEngine';
import { useSessionStore } from '../../stores/sessionStore';
import './NightActionScreen.scss';

export default function NightActionScreen() {
  const actionType = useGameStore((s) => s.actionType);
  const actionLabel = useGameStore((s) => s.actionLabel);
  const availableTargets = useGameStore((s) => s.availableTargets);
  const selectedTarget = useGameStore((s) => s.selectedTarget);
  const actionSubmitted = useGameStore((s) => s.actionSubmitted);
  const checkResults = useGameStore((s) => s.checkResults);
  const mafiaCanSkip = useGameStore((s) => s.mafiaCanSkip);
  const setSelectedTarget = useGameStore((s) => s.setSelectedTarget);
  const nightActionTimer = useSessionStore((s) => s.settings.night_action_timer_seconds);

  const [timeLeft, setTimeLeft] = useState(nightActionTimer);
  const [showCheckResult, setShowCheckResult] = useState<CheckResultEntry | null>(null);
  const [hiddenResults, setHiddenResults] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimeLeft(nightActionTimer);
  }, [actionType, nightActionTimer]);

  useEffect(() => {
    if (actionSubmitted || timeLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleTimeOut();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionSubmitted, timeLeft]);

  const handleTimeOut = () => {
    if (!actionSubmitted) {
      advanceNightAction();
    }
  };

  const handleConfirm = () => {
    if (!selectedTarget || actionSubmitted) return;
    submitNightAction(selectedTarget);

    if (actionType === 'check' || actionType === 'don_check') {
      setTimeout(() => {
        const results = useGameStore.getState().checkResults;
        const latest = results[results.length - 1];
        if (latest) {
          setShowCheckResult(latest);
        }
      }, 500);
    }
  };

  const handleSkip = () => {
    if (actionType === 'kill' && mafiaCanSkip) {
      skipMafiaKill();
    }
  };

  const toggleHideResult = (targetId: string) => {
    setHiddenResults((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  };

  const getTargetState = (targetId: string): 'default' | 'selected' | 'checked-mafia' | 'checked-city' | 'blocked' => {
    const result = checkResults.find((r) => r.targetId === targetId);
    if (result) {
      return result.team === 'mafia' ? 'checked-mafia' : 'checked-city';
    }
    if (selectedTarget === targetId) return 'selected';
    return 'default';
  };

  const isTargetDisabled = (targetId: string): boolean => {
    const result = checkResults.find((r) => r.targetId === targetId);
    if (result && result.team === 'city') return true;
    return false;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const getActionTitle = () => {
    switch (actionType) {
      case 'kill': return 'Ход Мафии';
      case 'check': return 'Ход Шерифа';
      case 'don_check': return 'Ход Дона';
      case 'heal': return 'Ход Доктора';
      case 'lover_visit': return 'Ход Любовницы';
      case 'maniac_kill': return 'Ход Маньяка';
      default: return 'Ночное действие';
    }
  };

  if (actionSubmitted && !showCheckResult) {
    return (
      <div className="night-action night-action--submitted">
        <div className="night-action__ambient" />
        <div className="night-action__submitted-content">
          <div className="night-action__check-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="night-action__submitted-title">Ваш выбор принят</h2>
          <p className="night-action__submitted-hint">Ожидание других игроков...</p>
        </div>
      </div>
    );
  }

  if (showCheckResult) {
    const isFound = showCheckResult.team === 'mafia';
    const targetName = availableTargets.find((t) => t.player_id === showCheckResult.targetId)?.name || '???';

    return (
      <div className={`night-action night-action--check-result ${isFound ? 'night-action--found' : 'night-action--clean'}`}>
        <div className="night-action__ambient" />
        <div className="night-action__check-result-content">
          <div className={`night-action__result-badge ${isFound ? 'night-action__result-badge--mafia' : 'night-action__result-badge--city'}`}>
            {isFound ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <h2 className="night-action__result-title">
            {isFound ? 'Мафия обнаружена!' : 'Чист'}
          </h2>
          <p className="night-action__result-name">{targetName}</p>
          <p className="night-action__result-team">
            {isFound ? 'Этот игрок — представитель мафии' : 'Этот игрок — мирный'}
          </p>
          <button
            className="night-action__result-continue"
            onClick={() => {
              setShowCheckResult(null);
              advanceNightAction();
            }}
          >
            Продолжить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="night-action">
      <div className="night-action__ambient" />
      <div className="night-action__blob night-action__blob--1" />
      <div className="night-action__blob night-action__blob--2" />
      <div className="night-action__blob night-action__blob--3" />

      <header className="night-action__header">
        <h2 className="night-action__title">{getActionTitle()}</h2>
        <div className={`night-action__timer ${timeLeft <= 5 ? 'night-action__timer--danger' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </header>

      <div className="night-action__label">{actionLabel}</div>

      <div className="night-action__targets">
        {availableTargets.map((target) => {
          const state = getTargetState(target.player_id);
          const disabled = isTargetDisabled(target.player_id);
          const hidden = hiddenResults.has(target.player_id);

          return (
            <button
              key={target.player_id}
              className={`night-action__target night-action__target--${state} ${disabled ? 'night-action__target--disabled' : ''} ${hidden ? 'night-action__target--hidden' : ''}`}
              onClick={() => {
                if (disabled) return;
                if (state === 'checked-mafia') {
                  toggleHideResult(target.player_id);
                  return;
                }
                setSelectedTarget(target.player_id);
              }}
              disabled={disabled}
            >
              <span className="night-action__target-name">{target.name}</span>
              {state === 'checked-mafia' && (
                <span className="night-action__target-badge night-action__target-badge--mafia">МАФИЯ</span>
              )}
              {state === 'checked-city' && (
                <span className="night-action__target-badge night-action__target-badge--city">ЧИСТ</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="night-action__actions">
        <button
          className="night-action__confirm"
          disabled={!selectedTarget}
          onClick={handleConfirm}
        >
          <span className="night-action__confirm-glow" />
          <span className="night-action__confirm-content">
            <span className="night-action__confirm-text">Подтвердить</span>
          </span>
        </button>
        {actionType === 'kill' && mafiaCanSkip && (
          <button className="night-action__skip" onClick={handleSkip}>
            Пропустить ход
          </button>
        )}
      </div>
    </div>
  );
}
