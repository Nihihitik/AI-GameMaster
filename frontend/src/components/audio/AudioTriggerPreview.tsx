import React, { useEffect, useRef, useState } from 'react';
import audioManifest from '../../data/audioManifest.json';
import './AudioTriggerPreview.scss';

type Variant = {
  audio_url: string;
  duration_ms: number;
  text: string;
  file_name: string;
};

type Pair = {
  id: number;
  gender: 'm' | 'f' | 'any';
  opener: Variant;
  closer: Variant;
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
  /** Заголовок (русское описание триггера). */
  label: string;
  description?: string;
}

/**
 * Превью одного триггера озвучки. variant — список вариантов с кнопками play.
 * name_pair — селектор имени игрока + кнопка проиграть склейку opener→имя→closer.
 */
export default function AudioTriggerPreview({ trigger, label, description }: Props) {
  const info = MANIFEST.triggers[trigger];
  if (!info) {
    return (
      <div className="audio-trigger-preview audio-trigger-preview--missing">
        <div className="audio-trigger-preview__header">
          <h4>{label}</h4>
          <span className="audio-trigger-preview__trigger">{trigger}</span>
        </div>
        {description && <p className="audio-trigger-preview__desc">{description}</p>}
        <div className="audio-trigger-preview__warn">Аудио для этого триггера в манифесте отсутствует — играется только текст</div>
      </div>
    );
  }

  return (
    <div className="audio-trigger-preview">
      <div className="audio-trigger-preview__header">
        <h4>{label}</h4>
        <span className="audio-trigger-preview__trigger">{trigger}</span>
      </div>
      {description && <p className="audio-trigger-preview__desc">{description}</p>}
      {info.kind === 'variant' ? (
        <VariantList variants={info.variants} />
      ) : (
        <PairPlayer pairs={info.pairs} />
      )}
    </div>
  );
}

function VariantList({ variants }: { variants: Variant[] }) {
  return (
    <div className="audio-trigger-preview__variants">
      <div className="audio-trigger-preview__count">{variants.length} вариант(ов) — в игре выбирается рандомно</div>
      {variants.map((v, i) => (
        <SingleAudioRow key={v.audio_url} index={i + 1} audio={v} />
      ))}
    </div>
  );
}

function SingleAudioRow({ index, audio }: { index: number; audio: Variant }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audio.audio_url);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('audio preview play() rejected:', err);
        setPlaying(false);
      });
      setPlaying(true);
    }
  };

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return (
    <div className="audio-row">
      <button
        className={`audio-row__play${playing ? ' audio-row__play--active' : ''}`}
        onClick={togglePlay}
        aria-label={playing ? 'Стоп' : 'Проиграть'}
      >
        {playing ? '■' : '▶'}
      </button>
      <div className="audio-row__body">
        <div className="audio-row__text">
          <span className="audio-row__index">{index}.</span> {audio.text || '(без текста)'}
        </div>
        <div className="audio-row__meta">
          <code className="audio-row__file">{audio.file_name}</code>
          <span className="audio-row__dur">{(audio.duration_ms / 1000).toFixed(1)}с</span>
        </div>
      </div>
    </div>
  );
}

function PairPlayer({ pairs }: { pairs: Pair[] }) {
  const [selectedName, setSelectedName] = useState<string>(MANIFEST.names[0]?.display ?? '');
  const [playing, setPlaying] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const selectedNameInfo = MANIFEST.names.find((n) => n.display === selectedName) ?? null;
  const selectedGender = selectedNameInfo?.gender ?? 'm';

  const candidatePairs = pairs.filter((p) => p.gender === selectedGender || p.gender === 'any');
  const fallbackPairs = candidatePairs.length > 0 ? candidatePairs : pairs;
  const [selectedPairId, setSelectedPairId] = useState<number>(fallbackPairs[0]?.id ?? 0);

  // если сменили имя и текущий pair_id больше не валиден — сбросить
  useEffect(() => {
    if (!fallbackPairs.find((p) => p.id === selectedPairId)) {
      setSelectedPairId(fallbackPairs[0]?.id ?? 0);
    }
  }, [selectedGender, fallbackPairs, selectedPairId]);

  const selectedPair = fallbackPairs.find((p) => p.id === selectedPairId) ?? fallbackPairs[0];

  const stop = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setPlaying(false);
  };

  const playSequence = () => {
    if (!selectedPair || !selectedNameInfo) return;
    if (playing) {
      stop();
      return;
    }
    const segments = [
      selectedPair.opener.audio_url,
      selectedNameInfo.intro_audio,
      selectedPair.closer.audio_url,
    ];
    setPlaying(true);
    let idx = 0;
    const a = new Audio();
    const onEnded = () => {
      idx += 1;
      if (idx >= segments.length) {
        setPlaying(false);
        return;
      }
      a.src = segments[idx];
      a.play().catch(() => setPlaying(false));
    };
    a.addEventListener('ended', onEnded);
    a.src = segments[0];
    a.play().catch(() => setPlaying(false));
    cleanupRef.current = () => {
      a.removeEventListener('ended', onEnded);
      try { a.pause(); } catch { /* noop */ }
    };
  };

  useEffect(() => () => {
    if (cleanupRef.current) cleanupRef.current();
  }, []);

  if (!selectedPair) {
    return <div className="audio-trigger-preview__warn">Нет пар для воспроизведения</div>;
  }

  const fullText = `${selectedPair.opener.text} ${selectedName} ${selectedPair.closer.text}`.trim();

  return (
    <div className="audio-trigger-preview__pair">
      <div className="audio-trigger-preview__count">
        {pairs.length} пар(ы) — в игре выбирается рандомно с учётом пола жертвы
      </div>
      <div className="pair-controls">
        <label>
          Имя жертвы:
          <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
            {MANIFEST.names.map((n) => (
              <option key={n.display} value={n.display}>{n.display} ({n.gender})</option>
            ))}
          </select>
        </label>
        <label>
          Пара:
          <select value={selectedPairId} onChange={(e) => setSelectedPairId(Number(e.target.value))}>
            {fallbackPairs.map((p) => (
              <option key={`${p.gender}-${p.id}`} value={p.id}>
                #{p.id} ({p.gender})
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className={`audio-row__play audio-row__play--lg${playing ? ' audio-row__play--active' : ''}`}
        onClick={playSequence}
      >
        {playing ? '■ Стоп' : '▶ Проиграть склейку'}
      </button>
      <div className="audio-row__text">{fullText}</div>
      <div className="audio-row__meta">
        <code className="audio-row__file">{selectedPair.opener.file_name}</code>
        <span>+</span>
        <code className="audio-row__file">{selectedNameInfo?.intro_audio.split('/').pop() ?? '?'}</code>
        <span>+</span>
        <code className="audio-row__file">{selectedPair.closer.file_name}</code>
      </div>
    </div>
  );
}

/** Список всех триггеров манифеста — для рендера всей ленты в /ui. */
export function getAllTriggers(): string[] {
  return Object.keys(MANIFEST.triggers).sort();
}

/** Все имена игроков из манифеста. */
export function getAllNames(): NameInfo[] {
  return MANIFEST.names;
}
