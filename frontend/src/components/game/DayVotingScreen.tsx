import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSessionStore } from '../../stores/sessionStore';
import './DayVotingScreen.scss';

export default function DayVotingScreen() {
  const availableTargets = useGameStore((s) => s.availableTargets);
  const voteSubmitted = useGameStore((s) => s.voteSubmitted);
  const votes = useGameStore((s) => s.votes);
  const myStatus = useGameStore((s) => s.myStatus);
  const dayBlockedPlayer = useGameStore((s) => s.dayBlockedPlayer);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const submitVote = useGameStore((s) => s.submitVote);
  const phase = useGameStore((s) => s.phase);
  const votingTimer = useSessionStore((s) => s.settings.voting_timer_seconds);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(votingTimer);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlocked = myPlayerId === dayBlockedPlayer;
  const canVote = myStatus === 'alive' && !isBlocked && !voteSubmitted;

  // Pull timer from phase when available, otherwise fall back to settings.
  useEffect(() => {
    const seconds = phase?.timer_seconds ?? votingTimer;
    setTimeLeft(seconds);
  }, [phase?.id, phase?.timer_seconds, votingTimer]);

  useEffect(() => {
    if (timeLeft <= 0 || voteSubmitted) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timeLeft, voteSubmitted]);

  const handleConfirmVote = async () => {
    if (!canVote || !selectedTarget || submitting) return;
    setSubmitting(true);
    try {
      await submitVote(selectedTarget);
    } catch {
      // Keep the button enabled so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipVote = async () => {
    if (!canVote || submitting) return;
    setSubmitting(true);
    try {
      await submitVote(null);
    } catch {
      // Swallow.
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (voteSubmitted) {
    return (
      <div className="day-voting day-voting--submitted">
        <div className="day-voting__ambient" />
        <div className="day-voting__submitted-content">
          <div className="day-voting__check-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="day-voting__submitted-title">Голос принят</h2>
          <p className="day-voting__submitted-hint">
            {votes
              ? `Проголосовали: ${votes.cast} / ${votes.total_expected}`
              : 'Ожидание других игроков...'}
          </p>
          <div className="day-voting__vote-progress">
            <div
              className="day-voting__vote-progress-bar"
              style={{ width: votes ? `${(votes.cast / votes.total_expected) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="day-voting">
      <div className="day-voting__ambient" />

      <header className="day-voting__header">
        <h2 className="day-voting__title">Голосование</h2>
        <div className={`day-voting__timer ${timeLeft <= 10 ? 'day-voting__timer--danger' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </header>

      {votes && (
        <div className="day-voting__vote-counter">
          Проголосовали: {votes.cast} / {votes.total_expected}
        </div>
      )}

      {isBlocked && (
        <div className="day-voting__blocked-notice">
          Вы не можете голосовать в этом раунде
        </div>
      )}

      {myStatus === 'dead' && (
        <div className="day-voting__spectator-notice">
          Вы наблюдаете за голосованием
        </div>
      )}

      <div className="day-voting__targets">
        {availableTargets.map((target) => (
          <button
            key={target.player_id}
            className={`day-voting__target ${selectedTarget === target.player_id ? 'day-voting__target--selected' : ''}`}
            onClick={() => canVote && setSelectedTarget(target.player_id)}
            disabled={!canVote}
          >
            <span className="day-voting__target-name">{target.name}</span>
            {selectedTarget === target.player_id && (
              <span className="day-voting__target-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="day-voting__actions">
        <button
          className="day-voting__confirm"
          disabled={!selectedTarget || !canVote || submitting}
          onClick={handleConfirmVote}
        >
          Подтвердить
        </button>
        <button
          className="day-voting__skip"
          disabled={!canVote || submitting}
          onClick={handleSkipVote}
        >
          Пропустить голос
        </button>
      </div>
    </div>
  );
}
