import { useEffect, useRef, useState } from 'react';

export interface CountdownConfig {
  enabled?: boolean;
  paused?: boolean;
  timerSeconds?: number | null;
  timerStartedAt?: string | null;
  fallbackSeconds: number;
  resetKey?: string | number | null;
}

export function computeRemainingSeconds(
  timerSeconds: number | null | undefined,
  timerStartedAt: string | null | undefined,
  fallbackSeconds: number,
): number {
  if (!timerSeconds) return fallbackSeconds;
  if (!timerStartedAt) return timerSeconds;

  const startedMs = Date.parse(timerStartedAt);
  if (Number.isNaN(startedMs)) {
    return timerSeconds;
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  return Math.max(0, timerSeconds - elapsed);
}

export function useCountdown({
  enabled = true,
  paused = false,
  timerSeconds,
  timerStartedAt,
  fallbackSeconds,
  resetKey,
}: CountdownConfig): number {
  const [timeLeft, setTimeLeft] = useState(() =>
    computeRemainingSeconds(timerSeconds, timerStartedAt, fallbackSeconds)
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTimeLeft(computeRemainingSeconds(timerSeconds, timerStartedAt, fallbackSeconds));
  }, [fallbackSeconds, resetKey, timerSeconds, timerStartedAt]);

  useEffect(() => {
    if (!enabled || paused || timeLeft <= 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, paused, timeLeft]);

  return timeLeft;
}
