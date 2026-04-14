import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './NarratorScreen.scss';

export default function NarratorScreen() {
  const announcement = useGameStore((s) => s.currentAnnouncement);
  const currentText = announcement?.text ?? '';
  const announcementKey = announcement?.key ?? currentText;
  const [displayedChars, setDisplayedChars] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayedChars(0);
  }, [announcementKey]);

  useEffect(() => {
    if (!currentText) return;
    if (displayedChars >= currentText.length) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setDisplayedChars((prev) => (prev >= currentText.length ? prev : prev + 1));
    }, 45);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [announcementKey, currentText, displayedChars]);

  const progress = useMemo(() => {
    if (!announcement?.duration_ms || !currentText.length) {
      return (displayedChars / Math.max(1, currentText.length)) * 100;
    }
    return Math.min(100, (displayedChars / Math.max(1, currentText.length)) * 100);
  }, [announcement?.duration_ms, currentText.length, displayedChars]);

  return (
    <div className="narrator-screen">
      <div className="narrator-screen__ambient" />

      <div className="narrator-screen__progress">
        <div className="narrator-screen__progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="narrator-screen__content">
        <div className="narrator-screen__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>

        <div className="narrator-screen__text-container">
          <p className="narrator-screen__text">
            {currentText.split('').map((char, i) => (
              <span
                key={`${announcement?.key ?? 'announcement'}-${i}`}
                className={`narrator-char ${i < displayedChars ? 'narrator-char--visible' : ''}`}
              >
                {char}
              </span>
            ))}
          </p>
        </div>

        <div className="narrator-screen__hint">Ведущий продолжает сценарий...</div>

        {announcement?.steps_total && announcement.steps_total > 1 && (
          <div className="narrator-screen__counter">
            {announcement.step_index ?? 1} / {announcement.steps_total}
          </div>
        )}
      </div>
    </div>
  );
}
