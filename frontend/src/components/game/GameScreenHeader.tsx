import React from 'react';
import PauseButton from './PauseButton';
import './GameScreenHeader.scss';

interface GameScreenHeaderProps {
  title: string;
  timer?: React.ReactNode;
  right?: React.ReactNode;
  showPause?: boolean;
  pauseSlot?: React.ReactNode;
  className?: string;
}

export default function GameScreenHeader({
  title,
  timer,
  right,
  showPause = true,
  pauseSlot,
  className,
}: GameScreenHeaderProps) {
  const classes = ['game-screen-header', className ?? ''].filter(Boolean).join(' ');
  const left = pauseSlot ?? (showPause ? <PauseButton /> : <span className="game-screen-header__spacer" />);

  return (
    <header className={classes}>
      <div className="game-screen-header__left">{left}</div>
      <h2 className="game-screen-header__title">{title}</h2>
      <div className="game-screen-header__right">
        {right}
        {timer}
      </div>
    </header>
  );
}
