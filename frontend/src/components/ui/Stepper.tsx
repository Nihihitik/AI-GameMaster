import React from 'react';
import './Stepper.scss';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  disabled?: boolean;
}

export default function Stepper({ value, min, max, onChange, label, disabled }: StepperProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1);
  };

  const increment = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className={`mafia-stepper ${disabled ? 'mafia-stepper--disabled' : ''}`}>
      {label && <span className="mafia-stepper__label">{label}</span>}
      <div className="mafia-stepper__controls">
        <button
          className="mafia-stepper__btn"
          onClick={decrement}
          disabled={disabled || value <= min}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="mafia-stepper__value">{value}</span>
        <button
          className="mafia-stepper__btn"
          onClick={increment}
          disabled={disabled || value >= max}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
