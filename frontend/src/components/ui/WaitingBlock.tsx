import React from 'react';
import Loader from './Loader';
import './WaitingBlock.scss';

interface WaitingBlockProps {
  text?: string;
  loaderSize?: number;
  layout?: 'column' | 'row';
  className?: string;
}

export default function WaitingBlock({
  text,
  loaderSize = 32,
  layout = 'column',
  className,
}: WaitingBlockProps) {
  const classes = [
    'waiting-block',
    `waiting-block--${layout}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <Loader size={loaderSize} />
      {text && <p className="waiting-block__text">{text}</p>}
    </div>
  );
}
