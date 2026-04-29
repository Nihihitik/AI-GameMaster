import { useEffect, useRef, useState } from 'react';
import { useAudioStore } from '../stores/audioStore';
import type { Announcement, AudioSegment } from '../types/game';

/**
 * Воспроизведение аудио озвучки для announcement, синхронизованное по
 * server-time (`started_at`).
 *
 * Правила:
 * - При смене announcement.key — восстанавливаем позицию: считаем elapsedMs
 *   от `started_at`, находим активный сегмент и проигрываем его с нужного offset.
 * - На событие `ended` HTMLAudioElement переключаемся на следующий сегмент.
 * - На unmount/смену announcement — пауза + сброс src.
 * - Если `audio_url` и `audio_segments` оба пусты — просто ничего не играем.
 *
 * Возвращает имя текущего файла (для дев-оверлея) и индекс активного сегмента.
 */
export function useNarrationAudio(announcement: Announcement | null) {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  // true пока браузер блокирует autoplay и мы ждём первого жеста пользователя.
  // Используется в UI чтобы показать prompt «Нажмите чтобы включить озвучку».
  const [needsGesture, setNeedsGesture] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const muted = useAudioStore((s) => s.muted);
  const volume = useAudioStore((s) => s.volume);

  const announcementKey = announcement?.key ?? null;

  // Реактивно прокидываем mute / volume в активный аудио-элемент.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = muted;
    a.volume = volume;
  }, [muted, volume]);

  // Каждый раз когда меняется announcement.key — стартуем заново.
  useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* noop */
      }
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setCurrentSegmentIndex(-1);
    setCurrentFileName(null);
    setNeedsGesture(false);

    if (!announcement) return;
    const segments = resolveSegments(announcement);
    if (segments.length === 0) return;

    const startedAtMs = announcement.started_at ? Date.parse(announcement.started_at) : NaN;
    const now = Date.now();
    const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, now - startedAtMs) : 0;

    let acc = 0;
    let activeIndex = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const dur = Math.max(0, segments[i].duration_ms || 0);
      if (elapsedMs < acc + dur) {
        activeIndex = i;
        break;
      }
      acc += dur;
      if (i === segments.length - 1) {
        // elapsed превысил суммарную длительность — больше не играем.
        return;
      }
    }
    const segmentOffsetMs = Math.max(0, elapsedMs - acc);

    // Создаём цепочку HTMLAudioElement: один элемент, переключаем src.
    const audio = new Audio();
    // Текущее состояние из стора применяем сразу (далее обновляется в эффекте).
    const audioState = useAudioStore.getState();
    audio.muted = audioState.muted;
    audio.volume = audioState.volume;
    audioRef.current = audio;

    // Текущий индекс сегмента. `let` — потому что замыкание `onEnded`
    // должно видеть актуальное значение между переключениями src.
    let currentIndex = activeIndex;
    let cancelled = false;
    // Ссылка на функцию-снятие висящих listener'ов жеста (autoplay retry).
    // Если announcement сменится до того, как пользователь кликнет —
    // надо не оставлять зомби-listener'ов на document.
    let gestureCleanupRef: (() => void) | null = null;

    const playFrom = (idx: number, offsetMs: number) => {
      if (cancelled) return;
      if (idx >= segments.length) {
        setCurrentSegmentIndex(-1);
        setCurrentFileName(null);
        return;
      }
      currentIndex = idx;
      setCurrentSegmentIndex(idx);
      setCurrentFileName(extractFileName(segments[idx].url));

      audio.src = segments[idx].url;

      const startPlayback = () => {
        if (cancelled) return;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => {
            // Если announcement уже сменился (effect cleanup отработал) —
            // не вешаем listener'ы, иначе они окажутся «зомби» на document.
            if (cancelled) return;
            // Браузерный autoplay-policy блокирует play() без user-gesture.
            // Это случается когда игрок открывает dev-ссылку в новой вкладке —
            // взаимодействия ещё не было.  Решение: ждём первого жеста и
            // ретраим play(). Audio.currentTime сохраняется, поэтому реплика
            // подхватится с актуальной позиции согласно server-time.
            console.warn('[narration audio] play() rejected, awaiting user gesture:', err);
            setNeedsGesture(true);
            const cleanupGesture = () => {
              document.removeEventListener('click', retry);
              document.removeEventListener('keydown', retry);
              document.removeEventListener('touchstart', retry);
              document.removeEventListener('pointerdown', retry);
            };
            const retry = () => {
              cleanupGesture();
              if (cancelled) return;
              const p = audio.play();
              if (p && typeof p.catch === 'function') {
                p.catch((retryErr) => {
                  console.warn('[narration audio] retry after gesture failed:', retryErr);
                });
              }
              // Жест был — снимаем prompt, даже если retry упал
              // (повторно prompt не поможет, нужно решать на стороне браузера).
              setNeedsGesture(false);
            };
            document.addEventListener('click', retry, { once: true });
            document.addEventListener('keydown', retry, { once: true });
            document.addEventListener('touchstart', retry, { once: true });
            document.addEventListener('pointerdown', retry, { once: true });
            gestureCleanupRef = cleanupGesture;
          });
        }
      };

      if (offsetMs > 0) {
        // Сидим в середину сегмента — ждём метаданные, иначе Safari/Firefox
        // могут проигнорировать или бросить INVALID_STATE_ERR.
        const onMetaLoaded = () => {
          if (cancelled) return;
          try {
            audio.currentTime = offsetMs / 1000;
          } catch {
            /* некоторые браузеры могут бросить, продолжим воспроизведение с 0 */
          }
          startPlayback();
        };
        audio.addEventListener('loadedmetadata', onMetaLoaded, { once: true });
        // Гарантируем загрузку.
        audio.load();
      } else {
        startPlayback();
      }
    };

    const onEnded = () => {
      playFrom(currentIndex + 1, 0);
    };

    audio.addEventListener('ended', onEnded);

    // Стартуем активный сегмент с нужным оффсетом.
    playFrom(activeIndex, segmentOffsetMs);

    return () => {
      cancelled = true;
      if (gestureCleanupRef) {
        gestureCleanupRef();
        gestureCleanupRef = null;
      }
      audio.removeEventListener('ended', onEnded);
      try {
        audio.pause();
      } catch {
        /* noop */
      }
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementKey]);

  return {
    currentSegmentIndex,
    currentFileName,
    needsGesture,
  };
}

function resolveSegments(a: Announcement): AudioSegment[] {
  if (a.audio_segments && a.audio_segments.length > 0) {
    return a.audio_segments;
  }
  if (a.audio_url) {
    return [{ url: a.audio_url, duration_ms: a.duration_ms }];
  }
  return [];
}

function extractFileName(url: string): string {
  try {
    const decoded = decodeURIComponent(url);
    const parts = decoded.split('/');
    return parts[parts.length - 1] || decoded;
  } catch {
    return url;
  }
}
