import React from 'react';
import './Toggle.scss';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={`mafia-toggle ${disabled ? 'mafia-toggle--disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="mafia-toggle__track">
        <span className="mafia-toggle__thumb" />
      </span>
      {label && <span className="mafia-toggle__label">{label}</span>}
    </label>
  );
}
