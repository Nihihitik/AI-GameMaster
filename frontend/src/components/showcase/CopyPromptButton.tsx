import React from 'react';
import { useCopyToClipboard } from './useCopyToClipboard';
import './CopyPromptButton.scss';

interface CopyPromptButtonProps {
  path: string;
  className?: string;
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function buildPromptText(path: string): string {
  return `${path}. Хочу изменить: `;
}

export default function CopyPromptButton({ path, className }: CopyPromptButtonProps) {
  const { state, copy } = useCopyToClipboard();

  const handleClick = () => {
    void copy(buildPromptText(path));
  };

  const label =
    state === 'copied' ? 'Скопировано' : state === 'error' ? 'Не удалось' : 'Copy prompt';
  const icon = state === 'copied' ? <CheckIcon /> : <CopyIcon />;

  const classes = [
    'copy-prompt-btn',
    `copy-prompt-btn--${state}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      aria-live="polite"
      aria-label={`Скопировать промпт для ${path}`}
    >
      <span className="copy-prompt-btn__icon">{icon}</span>
      <span className="copy-prompt-btn__label">{label}</span>
    </button>
  );
}
