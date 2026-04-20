import React from 'react';
import IconButton from './IconButton';
import './PageHeader.scss';

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function PageHeader({
  title,
  onBack,
  rightSlot,
  sticky = true,
  className,
}: PageHeaderProps) {
  const classes = [
    'page-header',
    sticky ? 'page-header--sticky' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={classes}>
      {onBack ? (
        <IconButton
          icon={<BackIcon />}
          onClick={onBack}
          ariaLabel="Назад"
          size={40}
        />
      ) : (
        <span className="page-header__spacer" />
      )}
      <h1 className="page-header__title">{title}</h1>
      <div className="page-header__right">{rightSlot ?? <span className="page-header__spacer" />}</div>
    </header>
  );
}
