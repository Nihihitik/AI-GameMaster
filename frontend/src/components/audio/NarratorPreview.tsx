import React, { useEffect, useMemo, useState } from 'react';
import audioManifest from '../../data/audioManifest.json';
import { useAudioStore } from '../../stores/audioStore';
import MiniNarrator from './MiniNarrator';
import AudioControls from './AudioControls';
import type { Announcement } from '../../types/game';
import './NarratorPreview.scss';

type Variant = {
  audio_url: string;
  duration_ms: number;
  text: string;
  file_name: string;
};

type PairSeg = {
  audio_url: string;
  duration_ms: number;
  text: string;
  file_name: string;
};

type Pair = {
  id: number;
  gender: 'm' | 'f' | 'any';
  opener: PairSeg;
  closer: PairSeg;
};

type TriggerInfo =
  | { kind: 'variant'; variants: Variant[] }
  | { kind: 'name_pair'; pairs: Pair[] };

type NameInfo = {
  display: string;
  gender: 'm' | 'f';
  intro_audio: string;
  intro_duration_ms: number;
};

const MANIFEST = audioManifest as {
  version: string;
  names: NameInfo[];
  triggers: Record<string, TriggerInfo>;
};

interface Props {
  trigger: string;
  label: string;
  description?: string;
}

/**
 * Карточка триггера озвучки в стиле игрового NarratorScreen.
 * Показывает реальный typewriter + аудио, как увидит игрок.
 *
 * - Для variant: при нажатии Play выбирается рандомный вариант (как в игре).
 * - Для name_pair: селектор имени жертвы; при Play играется склейка opener → имя → closer.
 *
 * AudioControls (mute + громкость) лежит в footer'е каждой карточки —
 * управляет глобальной озвучкой через audioStore.
 */
export default function NarratorPreview({ trigger, label, description }: Props) {
  const info = MANIFEST.triggers[trigger];
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [playKey, setPlayKey] = useState(0);

  const activePreviewKey = useAudioStore((s) => s.activePreviewKey);
  const setActivePreviewKey = useAudioStore((s) => s.setActivePreviewKey);

  // Когда другая карточка стартует play — глобальный activePreviewKey меняется.
  // Сбрасываем локальное состояние, чтобы UI и фактическая озвучка не расходились.
  useEffect(() => {
    if (announcement && activePreviewKey !== announcement.key) {
      setAnnouncement(null);
    }
  }, [activePreviewKey, announcement]);

  // Авто-сброс по окончании длительности — чтобы кнопка вернулась к "Сыграть",
  // а не зависла на "Стоп" уже после того, как аудио доиграло.
  useEffect(() => {
    if (!announcement?.duration_ms || !announcement.started_at) return;
    const startedAt = Date.parse(announcement.started_at);
    if (!Number.isFinite(startedAt)) return;
    const elapsed = Date.now() - startedAt;
    const remaining = announcement.duration_ms - elapsed + 300; // +300ms запас
    if (remaining <= 0) {
      setAnnouncement(null);
      return;
    }
    const t = setTimeout(() => {
      setAnnouncement((prev) => (prev?.key === announcement.key ? null : prev));
      setActivePreviewKey(null);
    }, remaining);
    return () => clearTimeout(t);
  }, [announcement, setActivePreviewKey]);

  const handlePlay = (a: Announcement) => {
    setAnnouncement(a);
    setPlayKey((k) => k + 1);
    setActivePreviewKey(a.key ?? null);
  };

  const handleStop = () => {
    setAnnouncement(null);
    setActivePreviewKey(null);
  };

  if (!info) {
    return (
      <article className="narrator-preview narrator-preview--missing">
        <header className="narrator-preview__head">
          <h4 className="narrator-preview__label">{label}</h4>
          <code className="narrator-preview__trigger">{trigger}</code>
        </header>
        {description && <p className="narrator-preview__desc">{description}</p>}
        <div className="narrator-preview__warn">
          Аудио для этого триггера в манифесте отсутствует — в игре будет показан только текст
        </div>
      </article>
    );
  }

  const isVariant = info.kind === 'variant';
  const fileName = announcement?.audio_file_name ?? null;

  return (
    <article className="narrator-preview">
      <header className="narrator-preview__head">
        <div className="narrator-preview__head-left">
          <h4 className="narrator-preview__label">{label}</h4>
          {description && <p className="narrator-preview__desc">{description}</p>}
        </div>
        <code className="narrator-preview__trigger">{trigger}</code>
      </header>

      <MiniNarrator key={playKey} announcement={announcement} />

      <div className="narrator-preview__filerow">
        <span className="narrator-preview__filelabel">Файл:</span>
        <code className="narrator-preview__filename">
          {fileName ?? (isVariant
            ? `${info.variants.length} вариант(а) — играется случайный`
            : `${info.pairs.length} пар — выбери имя и нажми "Сыграть"`)}
        </code>
      </div>

      <footer className="narrator-preview__footer">
        {isVariant ? (
          <VariantControls
            trigger={trigger}
            variants={info.variants}
            playing={!!announcement}
            onPlay={handlePlay}
            onStop={handleStop}
          />
        ) : (
          <PairControls
            trigger={trigger}
            pairs={info.pairs}
            playing={!!announcement}
            onPlay={handlePlay}
            onStop={handleStop}
          />
        )}
        <AudioControls variant="inline" />
      </footer>
    </article>
  );
}

function VariantControls({
  trigger,
  variants,
  playing,
  onPlay,
  onStop,
}: {
  trigger: string;
  variants: Variant[];
  playing: boolean;
  onPlay: (a: Announcement) => void;
  onStop: () => void;
}) {
  // -1 = «случайный» (как в реальной игре). 0..N-1 — конкретный вариант.
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const play = () => {
    if (variants.length === 0) return;
    const idx = selectedIdx >= 0 && selectedIdx < variants.length
      ? selectedIdx
      : Math.floor(Math.random() * variants.length);
    const v = variants[idx];
    onPlay({
      key: `preview:${trigger}:${idx}:${Date.now()}`,
      trigger,
      text: v.text,
      audio_url: v.audio_url,
      audio_file_name: v.file_name,
      duration_ms: v.duration_ms,
      started_at: new Date().toISOString(),
      blocking: true,
    });
  };

  return (
    <div className="narrator-preview__btn-group">
      {variants.length > 1 && (
        <label className="narrator-preview__name-field">
          <span>Реплика</span>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            disabled={playing}
          >
            <option value={-1}>Случайная (как в игре)</option>
            {variants.map((v, i) => (
              <option key={v.file_name} value={i}>
                {i + 1}. {truncate(v.text, 60) || v.file_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className={`narrator-preview__play-btn${playing ? ' narrator-preview__play-btn--stop' : ''}`}
        onClick={playing ? onStop : play}
        type="button"
      >
        {playing ? '■ Стоп' : '▶ Сыграть'}
      </button>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function PairControls({
  trigger,
  pairs,
  playing,
  onPlay,
  onStop,
}: {
  trigger: string;
  pairs: Pair[];
  playing: boolean;
  onPlay: (a: Announcement) => void;
  onStop: () => void;
}) {
  const [selectedName, setSelectedName] = useState(MANIFEST.names[0]?.display ?? '');
  // -1 = «случайная пара» (как в реальной игре). Иначе индекс в candidatePairs.
  const [selectedPairIdx, setSelectedPairIdx] = useState<number>(-1);
  const nameInfo = useMemo(
    () => MANIFEST.names.find((n) => n.display === selectedName) ?? null,
    [selectedName],
  );
  const targetGender: 'm' | 'f' | null = nameInfo?.gender ?? null;
  const candidatePairs = useMemo(() => {
    if (!targetGender) return pairs;
    const matched = pairs.filter((p) => p.gender === targetGender);
    return matched.length > 0 ? matched : pairs;
  }, [pairs, targetGender]);

  // При смене имени/пола набор подходящих пар меняется — сбрасываем выбор.
  useEffect(() => {
    setSelectedPairIdx(-1);
  }, [targetGender]);

  const play = () => {
    if (!nameInfo || candidatePairs.length === 0) return;
    const idx = selectedPairIdx >= 0 && selectedPairIdx < candidatePairs.length
      ? selectedPairIdx
      : Math.floor(Math.random() * candidatePairs.length);
    const pair = candidatePairs[idx];
    const segments = [
      { url: pair.opener.audio_url, duration_ms: pair.opener.duration_ms },
      { url: nameInfo.intro_audio, duration_ms: nameInfo.intro_duration_ms },
      { url: pair.closer.audio_url, duration_ms: pair.closer.duration_ms },
    ];
    const totalDuration = segments.reduce((s, x) => s + x.duration_ms, 0);
    const text = `${pair.opener.text} ${selectedName} ${pair.closer.text}`.trim();
    const fileName = `${pair.opener.file_name} + ${nameInfo.intro_audio.split('/').pop()} + ${pair.closer.file_name}`;
    onPlay({
      key: `preview:${trigger}:${pair.gender}:${pair.id}:${selectedName}:${Date.now()}`,
      trigger,
      text,
      audio_segments: segments,
      audio_file_name: fileName,
      duration_ms: totalDuration,
      started_at: new Date().toISOString(),
      blocking: true,
    });
  };

  return (
    <div className="narrator-preview__btn-group">
      <label className="narrator-preview__name-field">
        <span>Имя жертвы</span>
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          disabled={playing}
        >
          {MANIFEST.names.map((n) => (
            <option key={n.display} value={n.display}>
              {n.display} ({n.gender === 'f' ? 'ж' : 'м'})
            </option>
          ))}
        </select>
      </label>
      {candidatePairs.length > 1 && (
        <label className="narrator-preview__name-field">
          <span>Пара</span>
          <select
            value={selectedPairIdx}
            onChange={(e) => setSelectedPairIdx(Number(e.target.value))}
            disabled={playing}
          >
            <option value={-1}>Случайная (как в игре)</option>
            {candidatePairs.map((p, i) => (
              <option key={`${p.gender}-${p.id}`} value={i}>
                #{p.id} {p.gender !== 'any' ? `(${p.gender === 'f' ? 'ж' : 'м'}) ` : ''}— {truncate(p.opener.text, 50)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className={`narrator-preview__play-btn${playing ? ' narrator-preview__play-btn--stop' : ''}`}
        onClick={playing ? onStop : play}
        type="button"
      >
        {playing ? '■ Стоп' : '▶ Сыграть склейку'}
      </button>
    </div>
  );
}
