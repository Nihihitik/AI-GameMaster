import React from 'react';
import { DevLobbyPlayerLink } from '../../types/game';
import './DevPlayerQuickPill.scss';

interface DevPlayerQuickPillProps {
  playerLinks: DevLobbyPlayerLink[];
  onOpenPlayer: (url: string, isHostSlot: boolean) => void;
  onAddPlayer?: () => void;
  addDisabled?: boolean;
}

export default function DevPlayerQuickPill({
  playerLinks,
  onOpenPlayer,
  onAddPlayer,
  addDisabled = false,
}: DevPlayerQuickPillProps) {
  return (
    <div className="dev-player-pill" role="group" aria-label="Тестовые игроки">
      <div className="dev-player-pill__header">
        <span className="dev-player-pill__title">Тестовые игроки</span>
        {onAddPlayer && (
          <button
            type="button"
            className="dev-player-pill__add"
            onClick={onAddPlayer}
            disabled={addDisabled}
          >
            + игрок
          </button>
        )}
      </div>
      <div className="dev-player-pill__list">
        {playerLinks.map((link) => {
          const isHostSlot = link.slot_number === 1;
          return (
            <button
              key={link.player_slug}
              type="button"
              className={`dev-player-pill__player ${isHostSlot ? 'dev-player-pill__player--active' : ''}`}
              onClick={() => onOpenPlayer(link.url, isHostSlot)}
              disabled={isHostSlot}
            >
              <span className="dev-player-pill__player-slot">{link.player_slug}</span>
              <span className="dev-player-pill__player-name">{link.player_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
