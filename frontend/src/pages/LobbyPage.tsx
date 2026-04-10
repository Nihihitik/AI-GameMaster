import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Slider from '../components/ui/Slider';
import Stepper from '../components/ui/Stepper';
import Toggle from '../components/ui/Toggle';
import Loader from '../components/ui/Loader';
import { useSessionStore, MAX_PLAYERS, MIN_PLAYERS, getSpecialRolesCount, getCiviliansCount } from '../stores/sessionStore';
import { LobbyPlayer } from '../types/game';
import './LobbyPage.scss';

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const session = useSessionStore((s) => s.session);
  const players = useSessionStore((s) => s.players);
  const settings = useSessionStore((s) => s.settings);
  const isHost = useSessionStore((s) => s.isHost);
  const withStory = useSessionStore((s) => s.withStory);
  const setSettings = useSessionStore((s) => s.setSettings);
  const setWithStory = useSessionStore((s) => s.setWithStory);
  const addPlayer = useSessionStore((s) => s.addPlayer);
  const startGame = useSessionStore((s) => s.startGame);

  const specialCount = getSpecialRolesCount(settings.role_config);
  const civiliansCount = getCiviliansCount(players.length, settings.role_config);

  useEffect(() => {
    if (!session) {
      navigate('/', { replace: true });
      return;
    }

    if (players.length < 3) {
      const mockNames = ['Алексей', 'Мария', 'Дмитрий', 'Елена', 'Сергей', 'Анна', 'Павел', 'Ольга', 'Иван', 'Наталья', 'Кирилл'];
      const timers: ReturnType<typeof setTimeout>[] = [];
      const toAdd = Math.min(mockNames.length, MAX_PLAYERS - players.length);
      for (let i = 0; i < toAdd; i++) {
        const timer = setTimeout(() => {
          const newPlayer: LobbyPlayer = {
            id: `mock-player-${i + 2}`,
            name: mockNames[i],
            join_order: players.length + i + 1,
            is_host: false,
          };
          addPlayer(newPlayer);
        }, (i + 1) * 1800);
        timers.push(timer);
      }
      return () => timers.forEach(clearTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleCopyCode = () => {
    if (session?.code) {
      navigator.clipboard.writeText(session.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleStartGame = () => {
    startGame();
    if (withStory) {
      navigate(`/sessions/${code}/stories`);
    } else {
      navigate(`/game/${session?.id || 'mock'}`);
    }
  };

  const updateRoleConfig = (key: string, value: number) => {
    const newConfig = { ...settings.role_config, [key]: value };
    const newSpecial = getSpecialRolesCount(newConfig);
    if (newSpecial > MAX_PLAYERS) return;
    setSettings({ role_config: newConfig });
  };

  const canStart = players.length >= MIN_PLAYERS;

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <button className="lobby-header__back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="lobby-header__title">Лобби</h1>
        {isHost && (
          <button className="lobby-header__settings" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
        {!isHost && <div style={{ width: 40 }} />}
      </header>

      <main className="lobby-main">
        <div className="lobby-code-card" onClick={handleCopyCode}>
          <span className="lobby-code-card__label">Код сессии</span>
          <span className="lobby-code-card__code">{session?.code || code}</span>
          <span className="lobby-code-card__copy">
            {copied ? 'Скопировано!' : 'Нажмите, чтобы скопировать'}
          </span>
        </div>

        <div className="lobby-players">
          <div className="lobby-players__header">
            <h2 className="lobby-players__title">Игроки</h2>
            <span className="lobby-players__count">
              {players.length} / {MAX_PLAYERS}
            </span>
          </div>
          <div className="lobby-players__list">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`lobby-player-item ${player.is_host ? 'lobby-player-item--host' : ''}`}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="lobby-player-item__avatar">
                  <span>{player.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="lobby-player-item__info">
                  <span className="lobby-player-item__name">
                    {player.name}
                    {player.is_host && <span className="lobby-player-item__badge">Хост</span>}
                  </span>
                  <span className="lobby-player-item__order">Игрок #{player.join_order}</span>
                </div>
              </div>
            ))}
            {players.length < MAX_PLAYERS && (
              <div className="lobby-player-item lobby-player-item--empty">
                <Loader size={24} />
                <span className="lobby-player-item__waiting">Ожидание игроков...</span>
              </div>
            )}
          </div>
        </div>

        {isHost && (
          <div className="lobby-start">
            <Button onClick={handleStartGame} disabled={!canStart}>
              {canStart ? 'Начать игру' : `Минимум ${MIN_PLAYERS} игроков (сейчас ${players.length})`}
            </Button>
          </div>
        )}
        {!isHost && (
          <div className="lobby-waiting-msg">
            <Loader size={32} />
            <p>Ожидание начала игры...</p>
          </div>
        )}
      </main>

      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Настройки сессии"
      >
        <div className="lobby-settings">
          <div className="lobby-settings__section">
            <h4 className="lobby-settings__section-title">Таймеры</h4>
            <Slider
              label="Обсуждение"
              value={settings.discussion_timer_seconds}
              min={30}
              max={300}
              step={10}
              onChange={(v) => setSettings({ discussion_timer_seconds: v })}
            />
            <Slider
              label="Голосование"
              value={settings.voting_timer_seconds}
              min={15}
              max={120}
              step={5}
              onChange={(v) => setSettings({ voting_timer_seconds: v })}
            />
            <Slider
              label="Ночные действия"
              value={settings.night_action_timer_seconds}
              min={15}
              max={60}
              step={5}
              onChange={(v) => setSettings({ night_action_timer_seconds: v })}
            />
            <Slider
              label="Ознакомление с ролью"
              value={settings.role_reveal_timer_seconds}
              min={10}
              max={30}
              step={1}
              onChange={(v) => setSettings({ role_reveal_timer_seconds: v })}
            />
          </div>

          <div className="lobby-settings__section">
            <h4 className="lobby-settings__section-title">Роли</h4>
            <Stepper label="Мафия" value={settings.role_config.mafia} min={0} max={2}
              onChange={(v) => updateRoleConfig('mafia', v)} />
            <Stepper label="Дон Мафии" value={settings.role_config.don} min={0} max={2}
              onChange={(v) => updateRoleConfig('don', v)} />
            <Stepper label="Шериф" value={settings.role_config.sheriff} min={0} max={2}
              onChange={(v) => updateRoleConfig('sheriff', v)} />
            <Stepper label="Доктор" value={settings.role_config.doctor} min={0} max={2}
              onChange={(v) => updateRoleConfig('doctor', v)} />
            <Stepper label="Любовница" value={settings.role_config.lover} min={0} max={2}
              onChange={(v) => updateRoleConfig('lover', v)} />
            <Stepper label="Маньяк" value={settings.role_config.maniac} min={0} max={2}
              onChange={(v) => updateRoleConfig('maniac', v)} />

            <div className="lobby-settings__civilians">
              <span className="lobby-settings__civilians-label">Мирные жители</span>
              <span className="lobby-settings__civilians-count">{civiliansCount}</span>
            </div>

            <div className="lobby-settings__roles-summary">
              <span>Спец. ролей: {specialCount}</span>
              <span>Всего игроков: {players.length}</span>
              {specialCount > players.length && (
                <span className="lobby-settings__roles-warning">
                  Спец. ролей больше, чем игроков!
                </span>
              )}
            </div>
          </div>

          <div className="lobby-settings__section">
            <h4 className="lobby-settings__section-title">Сюжет</h4>
            <div className="lobby-settings__toggle-row">
              <Toggle
                label="С сюжетом"
                checked={withStory}
                onChange={setWithStory}
              />
            </div>
            {withStory && (
              <p className="lobby-settings__hint">
                После старта игроки перейдут на страницу выбора сюжета
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
