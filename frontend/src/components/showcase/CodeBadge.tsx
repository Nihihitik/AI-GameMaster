import React from 'react';
import { useCopyToClipboard } from './useCopyToClipboard';
import './CodeBadge.scss';

interface CodeBadgeProps {
  path: string;
  className?: string;
}

export default function CodeBadge({ path, className }: CodeBadgeProps) {
  const { state, copy } = useCopyToClipboard();

  const classes = [
    'code-badge',
    state === 'copied' ? 'code-badge--copied' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={() => void copy(path)}
      title="Скопировать путь"
    >
      <span className="code-badge__path">{path}</span>
      {state === 'copied' && <span className="code-badge__feedback">скопировано</span>}
    </button>
  );
}
