import React from 'react';
import { formatMmSs } from '../../utils/time';
import './Timer.scss';

interface TimerProps {
  seconds: number;
  dangerThreshold?: number;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function Timer({
  seconds,
  dangerThreshold = 10,
  variant = 'default',
  className,
}: TimerProps) {
  const isDanger = seconds > 0 && seconds <= dangerThreshold;
  const classes = [
    'timer',
    `timer--${variant}`,
    isDanger ? 'timer--danger' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{formatMmSs(seconds)}</span>;
}
