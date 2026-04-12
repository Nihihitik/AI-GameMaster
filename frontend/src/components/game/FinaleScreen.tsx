import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useSessionStore } from '../../stores/sessionStore';
import { roleImages } from '../../mocks/gameMocks';
import './FinaleScreen.scss';

export default function FinaleScreen() {
  const navigate = useNavigate();
  const result = useGameStore((s) => s.result);
  const resetGame = useGameStore((s) => s.reset);
  const resetSession = useSessionStore((s) => s.reset);

  if (!result) return null;

  const isCityWin = result.winner === 'city';
  const winnerLabel = result.winner === 'city'
    ? 'Победа мирных!'
    : result.winner === 'mafia'
      ? 'Победа мафии!'
      : 'Ничья';

  const handleGoHome = () => {
    resetGame();
    resetSession();
    navigate('/', { replace: true });
  };

  return (
    <div className={`finale ${isCityWin ? 'finale--city' : 'finale--mafia'}`}>
      <div className="finale__ambient" />

      <div className="finale__content">
        <div className="finale__trophy">
          {isCityWin ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 15v3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14.5 2l-5 5-2-2L2 10.5 13.5 22 19 16.5l-2-2 5-5z" />
            </svg>
          )}
        </div>

        <h1 className="finale__title">{winnerLabel}</h1>
        <p className="finale__announcement">{result.announcement.text}</p>

        <div className="finale__players">
          <h3 className="finale__players-title">Все роли</h3>
          <div className="finale__players-grid">
            {result.players.map((player) => (
              <div
                key={player.id}
                className={`finale__player ${player.status === 'dead' ? 'finale__player--dead' : ''} ${player.role.team === 'mafia' ? 'finale__player--mafia' : 'finale__player--city'}`}
              >
                <div className="finale__player-avatar">
                  <img
                    src={roleImages[player.role.name] || '/img/Obratnaya_storona_karty.png'}
                    alt={player.role.name}
                    className="finale__player-avatar-img"
                  />
                  {player.status === 'dead' && (
                    <div className="finale__player-dead-overlay">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="finale__player-info">
                  <span className="finale__player-name">{player.name}</span>
                  <span className={`finale__player-role ${player.role.team === 'mafia' ? 'finale__player-role--mafia' : ''}`}>
                    {player.role.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="finale__actions">
          <button className="finale__home-btn" onClick={handleGoHome}>
            На главную
          </button>
        </div>
      </div>
    </div>
  );
}
