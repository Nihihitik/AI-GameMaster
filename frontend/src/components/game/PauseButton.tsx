import React from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import './PauseButton.scss';

export default function PauseButton() {
  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setTimerPaused = useSessionStore((s) => s.setTimerPaused);

  return (
    <button
      className={`pause-btn ${timerPaused ? 'pause-btn--paused' : ''}`}
      onClick={() => setTimerPaused(!timerPaused)}
      title={timerPaused ? 'Продолжить' : 'Пауза'}
    >
      {timerPaused ? (
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
      )}
    </button>
  );
}
