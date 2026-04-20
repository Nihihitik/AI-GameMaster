import React from 'react';
import CodeBadge from './CodeBadge';
import CopyPromptButton from './CopyPromptButton';
import ReplayButton from './ReplayButton';
import './ShowcaseItem.scss';

interface ShowcaseState {
  label: string;
  node: React.ReactNode;
}

interface ShowcaseItemProps {
  name: string;
  path: string;
  description: string;
  animated?: boolean;
  onReplay?: () => void;
  replayLabel?: string;
  states?: ReadonlyArray<ShowcaseState>;
  children?: React.ReactNode;
  stageClassName?: string;
  className?: string;
  id?: string;
}

export default function ShowcaseItem({
  name,
  path,
  description,
  animated = false,
  onReplay,
  replayLabel,
  states,
  children,
  stageClassName,
  className,
  id,
}: ShowcaseItemProps) {
  const classes = ['showcase-item', className ?? ''].filter(Boolean).join(' ');
  const stageClasses = ['showcase-item__stage', stageClassName ?? ''].filter(Boolean).join(' ');

  return (
    <article className={classes} id={id}>
      <header className="showcase-item__head">
        <h3 className="showcase-item__name">{name}</h3>
        <CodeBadge path={path} />
      </header>
      {description && <p className="showcase-item__desc">{description}</p>}

      <div className="showcase-item__demo">
        {states ? (
          <div className="showcase-item__grid">
            {states.map((s) => (
              <div key={s.label} className="showcase-item__cell">
                <div className="showcase-item__cell-label">{s.label}</div>
                <div className={stageClasses}>{s.node}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={stageClasses}>{children}</div>
        )}
      </div>

      <footer className="showcase-item__actions">
        <CopyPromptButton path={path} />
        {animated && onReplay && (
          <ReplayButton onClick={onReplay} label={replayLabel} />
        )}
      </footer>
    </article>
  );
}
