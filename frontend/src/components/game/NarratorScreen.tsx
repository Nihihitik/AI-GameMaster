import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';
import './NarratorScreen.scss';

/**
 * NarratorScreen is a client-side announcer. It reads the latest announcement
 * (its `trigger` drives local text/audio selection) from gameStore and
 * optionally consumes pre-queued narrator texts for scripted transitions.
 *
 * Incoming WS `announcement` events write to gameStore.currentAnnouncement via
 * `queueAnnouncement`; this component displays the text.
 */
export default function NarratorScreen() {
  const narratorTexts = useGameStore((s) => s.narratorTexts);
  const narratorIndex = useGameStore((s) => s.narratorIndex);
  const advanceNarrator = useGameStore((s) => s.advanceNarrator);
  const currentAnnouncement = useGameStore((s) => s.currentAnnouncement);

  // Prefer explicit narrator texts if present; otherwise fall back to the latest announcement.
  const effectiveTexts = narratorTexts.length > 0
    ? narratorTexts
    : currentAnnouncement?.text
      ? [currentAnnouncement.text]
      : [];
  const effectiveIndex = narratorTexts.length > 0 ? narratorIndex : 0;

  const currentText = effectiveTexts[effectiveIndex] || '';
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [autoMode, setAutoMode] = useState(() => {
    try { return localStorage.getItem('narrator_auto') === '1'; } catch { return false; }
  });
  const [volume, setVolume] = useState(() => {
    try { return Number(localStorage.getItem('narrator_vol') ?? 80); } catch { return 80; }
  });
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('narrator_mute') === '1'; } catch { return false; }
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLastText = effectiveIndex >= effectiveTexts.length - 1;

  useEffect(() => {
    setDisplayedChars(0);
    setIsTyping(true);
  }, [effectiveIndex, currentText]);

  useEffect(() => {
    if (!isTyping || displayedChars >= currentText.length) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsTyping(false);
      return;
    }

    intervalRef.current = setInterval(() => {
      setDisplayedChars((prev) => {
        if (prev >= currentText.length) {
          setIsTyping(false);
          return prev;
        }
        return prev + 1;
      });
    }, 45);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTyping, currentText, displayedChars]);

  // Auto-advance when typing finishes
  useEffect(() => {
    if (autoMode && !isTyping && currentText.length > 0) {
      const delay = Math.max(2000, currentText.length * 40);
      autoTimerRef.current = setTimeout(() => {
        advanceNarrator();
      }, delay);
      return () => {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      };
    }
  }, [autoMode, isTyping, currentText, advanceNarrator]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    // Don't trigger on controls area
    const target = e.target as HTMLElement;
    if (target.closest('.narrator-screen__controls')) return;

    if (isTyping) {
      setDisplayedChars(currentText.length);
      setIsTyping(false);
    } else {
      advanceNarrator();
    }
  }, [isTyping, currentText.length, advanceNarrator]);

  const progress = effectiveTexts.length > 1
    ? ((effectiveIndex + 1) / effectiveTexts.length) * 100
    : displayedChars > 0 ? (displayedChars / Math.max(1, currentText.length)) * 100 : 0;

  return (
    <div className="narrator-screen" onClick={handleTap}>
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
                key={`${effectiveIndex}-${i}`}
                className={`narrator-char ${i < displayedChars ? 'narrator-char--visible' : ''}`}
              >
                {char}
              </span>
            ))}
          </p>
        </div>

        <div className="narrator-screen__hint">
          {autoMode
            ? 'Авто-режим включён'
            : isTyping
              ? 'Нажмите, чтобы пропустить'
              : isLastText
                ? 'Нажмите, чтобы продолжить'
                : 'Нажмите для следующей фразы'
          }
        </div>

        {effectiveTexts.length > 1 && (
          <div className="narrator-screen__counter">
            {effectiveIndex + 1} / {effectiveTexts.length}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="narrator-screen__controls">
        <button
          className={`narrator-screen__auto-btn ${autoMode ? 'narrator-screen__auto-btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); const next = !autoMode; setAutoMode(next); try { localStorage.setItem('narrator_auto', next ? '1' : '0'); } catch {} }}
          title="Авто-режим"
        >
          <span>АВТО</span>
        </button>

        <div className="narrator-screen__volume-group">
          <button
            className="narrator-screen__mute-btn"
            onClick={(e) => { e.stopPropagation(); const next = !muted; setMuted(next); try { localStorage.setItem('narrator_mute', next ? '1' : '0'); } catch {} }}
            title={muted ? 'Включить звук' : 'Выключить звук'}
          >
            {muted || volume === 0 ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>
          <input
            type="range"
            className="narrator-screen__volume-slider"
            min="0"
            max="100"
            value={muted ? 0 : volume}
            onChange={(e) => {
              e.stopPropagation();
              const v = Number(e.target.value);
              setVolume(v);
              try { localStorage.setItem('narrator_vol', String(v)); } catch {}
              if (v > 0) { setMuted(false); try { localStorage.setItem('narrator_mute', '0'); } catch {} }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
}
