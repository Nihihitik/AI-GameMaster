import React, { useState } from 'react';
import './CodeCard.scss';

interface CodeCardProps {
  code: string;
  label?: string;
  onCopy?: () => void;
  copyDuration?: number;
  className?: string;
}

export default function CodeCard({
  code,
  label = 'Код сессии',
  onCopy,
  copyDuration = 2000,
  className,
}: CodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), copyDuration);
    } catch {
      // clipboard may be unavailable (iframe, permissions) — silently ignore
    }
  };

  const classes = ['code-card', className ?? ''].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} onClick={handleClick}>
      <span className="code-card__label">{label}</span>
      <span className="code-card__code">{code}</span>
      <span className="code-card__hint">{copied ? 'Скопировано!' : 'Нажмите, чтобы скопировать'}</span>
    </button>
  );
}
