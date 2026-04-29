import React from 'react';
import audioManifest from '../../data/audioManifest.json';
import './CharacterNameSelect.scss';

export interface CharacterNameOption {
  display: string;
  gender: 'm' | 'f';
  intro_audio: string;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Имена, занятые другими игроками сессии (по display name). Будут disabled. */
  occupiedNames?: string[];
  /** Имя текущего игрока — оно никогда не disabled, даже если в occupiedNames. */
  selfName?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

const NAMES: CharacterNameOption[] = (audioManifest as any).names ?? [];

export default function CharacterNameSelect({
  value,
  onChange,
  occupiedNames = [],
  selfName,
  label = 'Персонаж',
  error,
  disabled,
}: Props) {
  const occupiedSet = new Set(occupiedNames.filter((n) => n !== selfName));
  const allTaken = NAMES.length > 0 && NAMES.every((n) => occupiedSet.has(n.display));

  return (
    <div className="character-name-select">
      <label className="character-name-select__label">{label}</label>
      <select
        className={`character-name-select__select${error ? ' character-name-select__select--error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || allTaken}
      >
        <option value="" disabled>
          {NAMES.length === 0 ? '(манифест пуст)' : 'Выберите имя…'}
        </option>
        {NAMES.map((n) => {
          const isOccupied = occupiedSet.has(n.display);
          return (
            <option key={n.display} value={n.display} disabled={isOccupied}>
              {n.display}
              {isOccupied ? ' — занято' : ''}
              {' '}({n.gender === 'f' ? 'ж' : 'м'})
            </option>
          );
        })}
      </select>
      {allTaken && !error && (
        <div className="character-name-select__hint character-name-select__hint--warn">
          Все имена заняты — больше игроков сессия не примет
        </div>
      )}
      {error && <div className="character-name-select__error">{error}</div>}
    </div>
  );
}

export function getAllCharacterNames(): string[] {
  return NAMES.map((n) => n.display);
}

export function getCharacterGender(display: string): 'm' | 'f' | null {
  const n = NAMES.find((x) => x.display === display);
  return n ? n.gender : null;
}
