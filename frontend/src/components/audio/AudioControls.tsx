import React from 'react';
import { useAudioStore } from '../../stores/audioStore';
import './AudioControls.scss';

interface Props {
  /** Стиль раскладки. floating — закреплён внизу справа; inline — в потоке. */
  variant?: 'floating' | 'inline';
  className?: string;
}

/**
 * Глобальный контрол озвучки: mute / unmute + слайдер громкости.
 * Состояние живёт в audioStore (с персистом в localStorage), читается всеми
 * компонентами озвучки через useNarrationAudio.
 */
export default function AudioControls({ variant = 'floating', className }: Props) {
  const muted = useAudioStore((s) => s.muted);
  const volume = useAudioStore((s) => s.volume);
  const toggleMute = useAudioStore((s) => s.toggleMute);
  const setVolume = useAudioStore((s) => s.setVolume);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    setVolume(v);
    if (v > 0 && muted) {
      // вернули звук — снимаем mute автоматически
      useAudioStore.getState().setMuted(false);
    }
  };

  return (
    <div
      className={[
        'audio-controls',
        variant === 'floating' ? 'audio-controls--floating' : 'audio-controls--inline',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Управление озвучкой"
    >
      <button
        className={`audio-controls__mute${muted ? ' audio-controls__mute--off' : ''}`}
        onClick={toggleMute}
        aria-pressed={muted}
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
        title={muted ? 'Включить звук' : 'Выключить звук'}
        type="button"
      >
        {muted || volume === 0 ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
      <input
        className="audio-controls__volume"
        type="range"
        min={0}
        max={100}
        value={Math.round((muted ? 0 : volume) * 100)}
        onChange={handleVolumeChange}
        aria-label="Громкость"
      />
    </div>
  );
}
