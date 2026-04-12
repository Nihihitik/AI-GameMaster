import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSessionStore } from '../../stores/sessionStore';
import './DayDiscussionScreen.scss';

/**
 * Compute remaining seconds from phase.timer_seconds + phase.timer_started_at.
 * If the server already kicked off the timer a while ago, align the UI
 * countdown instead of starting fresh.
 */
function computeRemainingSeconds(
  timerSeconds: number | null | undefined,
  timerStartedAt: string | null | undefined,
  fallback: number,
): number {
  if (!timerSeconds) return fallback;
  if (!timerStartedAt) return timerSeconds;
  const startedMs = Date.parse(timerStartedAt);
  if (Number.isNaN(startedMs)) return timerSeconds;
  const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  return Math.max(0, timerSeconds - elapsed);
}

export default function DayDiscussionScreen() {
  const players = useGameStore((s) => s.players);
  const nightResultDied = useGameStore((s) => s.nightResultDied);
  const dayBlockedPlayer = useGameStore((s) => s.dayBlockedPlayer);
  const myStatus = useGameStore((s) => s.myStatus);
  const phase = useGameStore((s) => s.phase);
  const discussionTimer = useSessionStore((s) => s.settings.discussion_timer_seconds);

  const [timeLeft, setTimeLeft] = useState(discussionTimer);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const remaining = computeRemainingSeconds(
      phase?.timer_seconds,
      phase?.timer_started_at,
      discussionTimer,
    );
    setTimeLeft(remaining);
  }, [phase?.id, phase?.timer_seconds, phase?.timer_started_at, discussionTimer]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timeLeft]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const alivePlayers = players.filter((p) => p.status === 'alive');
  const deadPlayers = players.filter((p) => p.status === 'dead');

  return (
    <div className="day-discussion">
      <div className="day-discussion__ambient" />

      <header className="day-discussion__header">
        <h2 className="day-discussion__title">Обсуждение</h2>
        <div className={`day-discussion__timer ${timeLeft <= 10 ? 'day-discussion__timer--danger' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </header>

      {nightResultDied && nightResultDied.length > 0 && (
        <div className="day-discussion__night-result">
          <div className="day-discussion__night-result-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v2m0 4h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div className="day-discussion__night-result-text">
            <span>Этой ночью погибли:</span>
            {nightResultDied.map((d) => (
              <span key={d.player_id} className="day-discussion__died-name">{d.name}</span>
            ))}
          </div>
        </div>
      )}

      {dayBlockedPlayer && (
        <div className="day-discussion__blocked-notice">
          Игрок {players.find((p) => p.id === dayBlockedPlayer)?.name} не участвует в обсуждении
        </div>
      )}

      <div className="day-discussion__players">
        <div className="day-discussion__section-title">Живые игроки ({alivePlayers.length})</div>
        {alivePlayers.map((player) => (
          <div
            key={player.id}
            className={`day-discussion__player ${player.id === dayBlockedPlayer ? 'day-discussion__player--blocked' : ''}`}
          >
            <div className="day-discussion__player-number">{player.join_order}</div>
            <span className="day-discussion__player-name">{player.name}</span>
            {player.id === dayBlockedPlayer && (
              <span className="day-discussion__player-tag">Заблокирован</span>
            )}
          </div>
        ))}

        {deadPlayers.length > 0 && (
          <>
            <div className="day-discussion__section-title day-discussion__section-title--dead">
              Выбывшие ({deadPlayers.length})
            </div>
            {deadPlayers.map((player) => (
              <div key={player.id} className="day-discussion__player day-discussion__player--dead">
                <div className="day-discussion__player-number">{player.join_order}</div>
                <span className="day-discussion__player-name">{player.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {myStatus === 'dead' && (
        <div className="day-discussion__spectator-notice">
          Вы наблюдаете за игрой
        </div>
      )}
    </div>
  );
}
