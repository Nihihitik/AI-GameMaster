import React from 'react';
import './Slider.scss';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  disabled?: boolean;
}

export default function Slider({ value, min, max, step = 1, onChange, label, unit = 'сек', disabled }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`mafia-slider ${disabled ? 'mafia-slider--disabled' : ''}`}>
      {label && (
        <div className="mafia-slider__header">
          <span className="mafia-slider__label">{label}</span>
          <span className="mafia-slider__value">{value} {unit}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{ '--progress': `${percentage}%` } as React.CSSProperties}
      />
    </div>
  );
}
