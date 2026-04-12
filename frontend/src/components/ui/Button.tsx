import React from 'react';
import './Button.scss';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
}

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z" />
  </svg>
);

export default function Button({ children, onClick, disabled, loading, type = 'button' }: ButtonProps) {
  return (
    <button
      className={`mafia-btn ${loading ? 'mafia-btn--loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
    >
      <span className="mafia-btn__glow" />
      <span className="mafia-btn__content">
        {loading && <span className="mafia-btn__spinner" />}
        <span className="mafia-btn__text">{children}</span>
        {!loading && (
          <span className="mafia-btn__icon">
            <ArrowIcon />
          </span>
        )}
      </span>
    </button>
  );
}

interface LinkButtonProps {
  text: string;
  linkText: string;
  onClick: () => void;
}

export function LinkButton({ text, linkText, onClick }: LinkButtonProps) {
  return (
    <button className="mafia-link-btn" onClick={onClick} type="button">
      {text}<span>{linkText}</span>
    </button>
  );
}
