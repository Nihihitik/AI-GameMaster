import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Slider from '../components/ui/Slider';
import Stepper from '../components/ui/Stepper';
import Toggle from '../components/ui/Toggle';
import Loader from '../components/ui/Loader';
import { useSessionStore, MAX_PLAYERS, MIN_PLAYERS, getSpecialRolesCount, getCiviliansCount } from '../stores/sessionStore';
import { useGameStore } from '../stores/gameStore';
import { gameApi } from '../api/gameApi';
import { sessionApi } from '../api/sessionApi';
import { wsClient } from '../api/wsClient';
import './LobbyPage.scss';

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const session = useSessionStore((s) => s.session);
  const players = useSessionStore((s) => s.players);
  const settings = useSessionStore((s) => s.settings);
  const isHost = useSessionStore((s) => s.isHost);
  const withStory = useSessionStore((s) => s.withStory);
  const setWithStory = useSessionStore((s) => s.setWithStory);
  const setSettings = useSessionStore((s) => s.setSettings);

  // Защита от двойного leave/close API-запроса при перехвате навигации.
  const leavingRef = useRef(false);
  // Флаг "разрешить текущую навигацию без вызова leave/close" — ставится при старте игры,
  // чтобы переход в /game/... или /sessions/:code/stories прошёл без закрытия сессии.
  const allowNavigationRef = useRef(false);

  // Общий хелпер: для хоста закрываем всю сессию, для обычного игрока — только его слот.
  const leaveSessionIfAny = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const state = useSessionStore.getState();
    const current = state.session;
    if (!current) {
      state.reset();
      return;
    }
    try {
      if (state.isHost) {
        await sessionApi.close(current.id);
      } else {
        await sessionApi.leave(current.id);
      }
    } catch {
      // Глушим: если игрока уже нет (404) или сессия уже закрыта — всё равно чистим состояние.
    } finally {
      state.reset();
    }
  };

  // Перехватываем любую SPA-навигацию из лобби (back-кнопка шапки, браузерный back, "На главную"
  // в error-view). F5/reload здесь не ловится — это специально, чтобы не выбивать игрока при
  // перезагрузке страницы (см. план).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavigationRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      (async () => {
        allowNavigationRef.current = true;
        await leaveSessionIfAny();
        blocker.proceed();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  const specialCount = getSpecialRolesCount(settings.role_config);
  const civiliansCount = getCiviliansCount(session?.player_count || players.length, settings.role_config);

  // Load session + open WebSocket on mount; tear down on unmount.
  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }

    // Сбрасываем игровое состояние от прошлой игры, чтобы реакция ниже на myRole
    // срабатывала только на новый game_started + role_assigned по WS.
    useGameStore.getState().reset();

    let cancelled = false;

    (async () => {
      try {
        await useSessionStore.getState().loadByCode(code);
        if (cancelled) return;
        const loaded = useSessionStore.getState().session;
        if (loaded) {
          wsClient.connect(loaded.id);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'Не удалось загрузить сессию');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      wsClient.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Когда не-хост получает по WS свою роль (event role_assigned после game_started),
  // переходим в игру. Для хоста переход выполняет handleStartGame, поэтому здесь !isHost.
  const myRole = useGameStore((s) => s.myRole);
  useEffect(() => {
    if (!myRole || isHost || !session) return;
    allowNavigationRef.current = true;
    navigate(`/game/${session.id}`);
  }, [myRole, isHost, session, navigate]);

  const handleCopyCode = () => {
    if (session?.code) {
      navigator.clipboard.writeText(session.code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleStartGame = async () => {
    if (!session) return;
    setStarting(true);
    try {
      await gameApi.start(session.id);
      // Разрешаем blocker'у пропустить переход в игру — сессию НЕ закрываем.
      allowNavigationRef.current = true;
      if (withStory) {
        navigate(`/sessions/${code}/stories`);
      } else {
        navigate(`/game/${session.id}`);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Не удалось начать игру');
    } finally {
      setStarting(false);
    }
  };

  const updateRoleConfig = async (key: string, value: number) => {
    const newConfig = { ...settings.role_config, [key]: value };
    const newSpecial = getSpecialRolesCount(newConfig);
    if (newSpecial > MAX_PLAYERS) return;
    try {
      await setSettings({ role_config: newConfig });
    } catch (err) {
      // Swallow — UI stays on previous settings.
    }
  };

  const handleTimerChange = async (partial: Partial<{
    discussion_timer_seconds: number;
    voting_timer_seconds: number;
    night_action_timer_seconds: number;
    role_reveal_timer_seconds: number;
  }>) => {
    try {
      await setSettings(partial);
    } catch (err) {
      // Swallow.
    }
  };

  const rolesExceedPlayers = specialCount > players.length;
  const canStart = players.length >= MIN_PLAYERS && !rolesExceedPlayers;

  if (loading) {
    return (
      <div className="lobby-page lobby-page--loading">
        <Loader size={48} />
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="lobby-page lobby-page--error">
        <p>{loadError || 'Сессия не найдена'}</p>
        <Button onClick={() => navigate('/', { replace: true })}>На главную</Button>
      </div>
    );
  }

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
          <span className="lobby-code-card__code">{session.code}</span>
          <span className="lobby-code-card__copy">
            {copied ? 'Скопировано!' : 'Нажмите, чтобы скопировать'}
          </span>
        </div>

        <div className="lobby-players">
          <div className="lobby-players__header">
            <h2 className="lobby-players__title">Игроки</h2>
            <span className="lobby-players__count">
              {players.length} / {session.player_count}
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
            {players.length < session.player_count && (
              <div className="lobby-player-item lobby-player-item--empty">
                <Loader size={24} />
                <span className="lobby-player-item__waiting">Ожидание игроков...</span>
              </div>
            )}
          </div>
        </div>

        {isHost && (
          <div className="lobby-start">
            <Button onClick={handleStartGame} disabled={!canStart || starting}>
              {starting
                ? 'Запуск...'
                : rolesExceedPlayers
                  ? `Ролей (${specialCount}) больше, чем игроков (${players.length})!`
                  : canStart
                    ? 'Начать игру'
                    : `Минимум ${MIN_PLAYERS} игроков (сейчас ${players.length})`
              }
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
              onChange={(v) => handleTimerChange({ discussion_timer_seconds: v })}
            />
            <Slider
              label="Голосование"
              value={settings.voting_timer_seconds}
              min={15}
              max={120}
              step={5}
              onChange={(v) => handleTimerChange({ voting_timer_seconds: v })}
            />
            <Slider
              label="Ночные действия"
              value={settings.night_action_timer_seconds}
              min={15}
              max={60}
              step={5}
              onChange={(v) => handleTimerChange({ night_action_timer_seconds: v })}
            />
            <Slider
              label="Ознакомление с ролью"
              value={settings.role_reveal_timer_seconds}
              min={10}
              max={30}
              step={1}
              onChange={(v) => handleTimerChange({ role_reveal_timer_seconds: v })}
            />
          </div>

          <div className="lobby-settings__section">
            <h4 className="lobby-settings__section-title">Роли</h4>
            <Stepper label="Мафия" value={settings.role_config.mafia} min={0} max={2}
              onChange={(v) => updateRoleConfig('mafia', v)} />
            <Stepper label="Дон Мафии" value={settings.role_config.don} min={0} max={1}
              onChange={(v) => updateRoleConfig('don', v)} />
            <Stepper label="Шериф" value={settings.role_config.sheriff} min={0} max={1}
              onChange={(v) => updateRoleConfig('sheriff', v)} />
            <Stepper label="Доктор" value={settings.role_config.doctor} min={0} max={1}
              onChange={(v) => updateRoleConfig('doctor', v)} />
            <Stepper label="Любовница" value={settings.role_config.lover} min={0} max={1}
              onChange={(v) => updateRoleConfig('lover', v)} />
            <Stepper label="Маньяк" value={settings.role_config.maniac} min={0} max={1}
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
