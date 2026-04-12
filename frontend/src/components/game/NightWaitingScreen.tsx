import React from 'react';
import './NightWaitingScreen.scss';

export default function NightWaitingScreen() {
  return (
    <div className="night-waiting uiverse-midnight-sky">
      <div className="sky-canvas">
        <div className="stars stars-1" />
        <div className="stars stars-2" />
        <div className="stars stars-3" />
        <div className="meteor m1" />
        <div className="meteor m2" />
        <div className="meteor m3" />
      </div>
      <div className="night-waiting__content">
        <div className="night-waiting__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
        <h2 className="night-waiting__title">Город спит...</h2>
        <p className="night-waiting__hint">Ожидайте завершения ночных действий</p>
        <div className="night-waiting__dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
