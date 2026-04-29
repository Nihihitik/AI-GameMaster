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
            // Браузерный autoplay-policy может потребовать жест пользователя.
            // На /lobby пользователь уже жал кнопки → к игре жест есть.
            // В крайнем случае молча отключаемся — typewriter останется.
            console.warn('[narration audio] play() rejected:', err);
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
