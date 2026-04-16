import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore, CheckResultEntry } from '../../stores/gameStore';
import { useSessionStore } from '../../stores/sessionStore';
import PauseButton from './PauseButton';
import { useCountdown } from '../../hooks/useCountdown';
import './NightActionScreen.scss';

export default function NightActionScreen() {
  const actionType = useGameStore((s) => s.actionType);
  const actionLabel = useGameStore((s) => s.actionLabel);
  const availableTargets = useGameStore((s) => s.availableTargets);
  const selectedTarget = useGameStore((s) => s.selectedTarget);
  const actionSubmitted = useGameStore((s) => s.actionSubmitted);
  const checkResults = useGameStore((s) => s.checkResults);
  const setSelectedTarget = useGameStore((s) => s.setSelectedTarget);
  const submitNightAction = useGameStore((s) => s.submitNightAction);
  const healRestriction = useGameStore((s) => s.healRestriction);
  const phase = useGameStore((s) => s.phase);
  const nightActionTimer = useSessionStore((s) => s.settings.night_action_timer_seconds);
  const timerPaused = useSessionStore((s) => s.timerPaused);

  const [showCheckResult, setShowCheckResult] = useState<CheckResultEntry | null>(null);
  const [hiddenResults, setHiddenResults] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const lastCheckCountRef = useRef(checkResults.length);
  const timeLeft = useCountdown({
    paused: timerPaused,
    fallbackSeconds: nightActionTimer,
    timerSeconds: phase?.timer_seconds,
    timerStartedAt: phase?.timer_started_at,
    resetKey: `${phase?.id ?? ''}|${actionType ?? ''}`,
  });

  // Surface a newly arrived check result (from WS or inline response).
  useEffect(() => {
    if (checkResults.length > lastCheckCountRef.current) {
      const latest = checkResults[checkResults.length - 1];
      if (latest && (latest.actionType === 'check' || latest.actionType === 'don_check')) {
        setShowCheckResult(latest);
      }
    }
    lastCheckCountRef.current = checkResults.length;
  }, [checkResults]);

  const handleConfirm = async () => {
    if (!selectedTarget || actionSubmitted || submitting) return;
    setSubmitting(true);
    try {
      await submitNightAction(selectedTarget);
    } catch (err) {
      // Error path — reset submitting state so the user can retry.
    } finally {
      setSubmitting(false);
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

  const checkResultMap = useMemo(() => {
    const map = new Map<string, CheckResultEntry>();
    for (const r of checkResults) {
      map.set(r.targetId, r);
    }
    return map;
  }, [checkResults]);

  const getTargetState = (targetId: string): 'default' | 'selected' | 'checked-mafia' | 'checked-city' | 'blocked' => {
    const result = checkResultMap.get(targetId);
    if (result) {
      if (result.actionType === 'don_check') {
        return result.isSheriff ? 'checked-mafia' : 'checked-city';
      }
      if (result.team === 'mafia') return 'checked-mafia';
      if (result.team === 'city' || result.team === 'maniac') return 'checked-city';
    }
    if (selectedTarget === targetId) return 'selected';
    return 'default';
  };

  const isTargetDisabled = (targetId: string): boolean => {
    const result = checkResultMap.get(targetId);
    if (result) {
      if (result.actionType === 'don_check' && !result.isSheriff) return true;
      if (result.team === 'city') return true;
    }
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

  if (showCheckResult) {
    const isCheck = showCheckResult.actionType === 'check';
    const isDonCheck = showCheckResult.actionType === 'don_check';
    const isMafia = isCheck
      ? showCheckResult.team === 'mafia'
      : isDonCheck
        ? !!showCheckResult.isSheriff // for don: "match" — we show similar alerting
        : false;
    const targetName = availableTargets.find((t) => t.player_id === showCheckResult.targetId)?.name || '???';

    let title = isMafia ? 'Мафия обнаружена!' : 'Чист';
    let teamText = isMafia ? 'Этот игрок — представитель мафии' : 'Этот игрок — мирный';
    if (isDonCheck) {
      title = showCheckResult.isSheriff ? 'Найден Шериф!' : 'Не Шериф';
      teamText = showCheckResult.isSheriff
        ? 'Этот игрок — шериф'
        : 'Этот игрок не является шерифом';
    }

    return (
      <div className={`night-action night-action--check-result ${isMafia ? 'night-action--found' : 'night-action--clean'}`}>
        <div className="night-action__ambient" />
        <div className="night-action__check-result-content">
          <div className={`night-action__result-badge ${isMafia ? 'night-action__result-badge--mafia' : 'night-action__result-badge--city'}`}>
            {isMafia ? (
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
          <h2 className="night-action__result-title">{title}</h2>
          <p className="night-action__result-name">{targetName}</p>
          <p className="night-action__result-team">{teamText}</p>
          <button
            className="night-action__result-continue"
            onClick={() => setShowCheckResult(null)}
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
        <PauseButton />
        <h2 className="night-action__title">{getActionTitle()}</h2>
        <div className={`night-action__timer ${timeLeft <= 5 ? 'night-action__timer--danger' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </header>

      <div className="night-action__label">{actionLabel}</div>

      {actionSubmitted && (
        <div className="night-action__heal-restriction">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Ваш выбор принят. Ход завершится, когда таймер истечёт.</span>
        </div>
      )}

      {healRestriction && actionType === 'heal' && (
        <div className="night-action__heal-restriction">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span>{healRestriction.name}: {healRestriction.reason}</span>
        </div>
      )}

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
          disabled={!selectedTarget || submitting || actionSubmitted}
          onClick={handleConfirm}
        >
          <span className="night-action__confirm-glow" />
          <span className="night-action__confirm-content">
            <span className="night-action__confirm-text">
              {actionSubmitted ? 'Выбор принят' : submitting ? 'Отправка...' : 'Подтвердить'}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
