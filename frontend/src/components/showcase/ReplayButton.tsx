import React from 'react';
import './ReplayButton.scss';

interface ReplayButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

const ReplayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export default function ReplayButton({
  onClick,
  label = 'Запустить анимацию',
  className,
}: ReplayButtonProps) {
  const classes = ['replay-btn', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} onClick={onClick} aria-label={label}>
      <span className="replay-btn__icon"><ReplayIcon /></span>
      <span className="replay-btn__label">{label}</span>
    </button>
  );
}
