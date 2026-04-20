import React from 'react';
import './Badge.scss';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'default'
    | 'host'
    | 'mafia'
    | 'city'
    | 'pro'
    | 'dead'
    | 'blocked';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
}: BadgeProps) {
  const classes = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
