import React from 'react';
import './Alert.scss';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'success' | 'info' | 'warning';
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
}

export default function Alert({
  children,
  variant = 'error',
  onDismiss,
  compact = false,
  className,
}: AlertProps) {
  const classes = [
    'alert',
    `alert--${variant}`,
    compact ? 'alert--compact' : '',
    onDismiss ? 'alert--dismissible' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={onDismiss}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
