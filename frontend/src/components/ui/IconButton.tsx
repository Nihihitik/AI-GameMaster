import React from 'react';
import './IconButton.scss';

interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  variant?: 'circle' | 'ghost';
  size?: number;
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}

export default function IconButton({
  icon,
  onClick,
  ariaLabel,
  variant = 'circle',
  size = 40,
  disabled = false,
  title,
  className,
  type = 'button',
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    `icon-btn--${variant}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      style={{ width: size, height: size }}
    >
      {icon}
    </button>
  );
}
