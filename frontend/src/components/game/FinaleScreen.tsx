import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../stores/gameStore';
import { useSessionStore } from '../../stores/sessionStore';
import { gameApi } from '../../api/gameApi';
import { getRoleInfo, CARD_BACK_IMAGE } from '../../utils/roles';
import './FinaleScreen.scss';

export default function FinaleScreen() {
  const navigate = useNavigate();
  const result = useGameStore((s) => s.result);
  const sessionId = useGameStore((s) => s.sessionId);
  const resetGame = useGameStore((s) => s.reset);
  const resetSession = useSessionStore((s) => s.reset);
  const isHost = useSessionStore((s) => s.isHost);
  const [resetting, setResetting] = useState(false);

  if (!result) return null;

  const winner = result.winner;
  const isCityWin = winner === 'city';
  const winnerLabel =
    winner === 'city' ? 'Победа мирных!'
    : winner === 'mafia' ? 'Победа мафии!'
    : winner === 'maniac' ? 'Победа маньяка!'
    : winner
      ? `Победа: ${winner}`
      : 'Ничья';

  const handleGoHome = () => {
    resetGame();
    resetSession();
    navigate('/', { replace: true });
  };

  const handleBackToLobby = async () => {
    if (!sessionId || resetting) return;
    setResetting(true);
    try {
      const resp = await gameApi.resetToLobby(sessionId);
      resetGame();
      navigate(`/lobby/${resp.data.session_code}`, { replace: true });
    } catch {
      setResetting(false);
    }
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
        {result.announcement?.text && (
          <p className="finale__announcement">{result.announcement.text}</p>
        )}

        <div className="finale__players">
          <h3 className="finale__players-title">Все роли</h3>
          <div className="finale__players-grid">
            {(result.players || []).map((player) => {
              const info = getRoleInfo(player.role);
              const displayName = info?.displayName ?? player.role?.name ?? '—';
              const team = info?.team ?? player.role?.team ?? 'city';
              return (
                <div
                  key={player.id}
                  className={`finale__player ${player.status === 'dead' ? 'finale__player--dead' : ''} ${team === 'mafia' ? 'finale__player--mafia' : 'finale__player--city'}`}
                >
                  <div className="finale__player-avatar">
                    <img
                      src={info?.image ?? CARD_BACK_IMAGE}
                      alt={displayName}
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
                    <span className={`finale__player-role ${team === 'mafia' ? 'finale__player-role--mafia' : ''}`}>
                      {displayName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="finale__actions">
          {isHost && (
            <button
              className="finale__lobby-btn"
              onClick={handleBackToLobby}
              disabled={resetting}
            >
              {resetting ? 'Возврат...' : 'Вернуться в лобби'}
            </button>
          )}
          <button className="finale__home-btn" onClick={handleGoHome}>
            На главную
          </button>
        </div>
      </div>
    </div>
  );
}
