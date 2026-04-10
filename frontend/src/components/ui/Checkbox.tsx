import React from 'react';
import './Checkbox.scss';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Checkbox({ checked, onChange, disabled }: CheckboxProps) {
  return (
    <label className={`radio-input ${disabled ? 'radio-input--disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="plus1">
        <div className="plus2" />
      </div>
    </label>
  );
}
