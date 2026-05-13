import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Alert from '../components/ui/Alert';
import Timer from '../components/ui/Timer';
import GameScreenHeader from '../components/game/GameScreenHeader';
import { useSessionStore } from '../stores/sessionStore';
import { useGameStore } from '../stores/gameStore';
import audioManifest from '../data/audioManifest.json';
import type { CharacterNameOption } from '../components/audio/CharacterNameSelect';
import { getCharacterDescription } from '../utils/characterDescriptions';
import { logger } from '../services/logger';
import { usePageViewLogger } from '../hooks/usePageViewLogger';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { gameApi } from '../api/gameApi';
import { sessionApi } from '../api/sessionApi';
import { wsClient } from '../api/wsClient';
import {
  AUDIO_PRELOAD_MANIFEST_VERSION,
  getAudioPreloadProgress,
  preloadNarrationAudio,
  subscribeAudioPreload,
  type AudioPreloadProgress,
} from '../utils/audioPreloader';
import './StorySelectionPage.scss';

type Phase = 'story' | 'name-pick';

const CLASSIC_STORY = {
  id: 'classic',
  title: 'Классический',
  description: 'Базовый режим Мафии без дополнительного сюжета.',
};

const NAMES: CharacterNameOption[] = (audioManifest as any).names ?? [];

const STORY_DISPLAY_MS = 2500;
const NAME_PICK_DURATION_SECONDS = 60;

export default function StorySelectionPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('story');
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [nameTimer, setNameTimer] = useState<number>(NAME_PICK_DURATION_SECONDS);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [audioPreloadProgress, setAudioPreloadProgress] = useState<AudioPreloadProgress>(() =>
    getAudioPreloadProgress()
  );

  const session = useSessionStore((s) => s.session);
  const players = useSessionStore((s) => s.players);
  const myPlayerId = useSessionStore((s) => s.myPlayerId);
  const isHost = useSessionStore((s) => s.isHost);
  const audioPreloadStatus = useSessionStore((s) => s.audioPreloadStatus);
  const setAudioPreloadStatus = useSessionStore((s) => s.setAudioPreloadStatus);
  const setSelectedStory = useSessionStore((s) => s.setSelectedStory);
  const setMyName = useSessionStore((s) => s.setMyName);
  const loadByCode = useSessionStore((s) => s.loadByCode);
  const myRole = useGameStore((s) => s.myRole);

  usePageViewLogger('StorySelectionPage', { sessionId: session?.id ?? null });

  const navigatingRef = useRef(false);
  const autoStartedRef = useRef(false);

  // Если попали сюда без предварительного хэндшейка (прямой URL / релоад) — подтягиваем
  // сессию по коду, чтобы players/myPlayerId были доступны для выбора имени.
  useEffect(() => {
    if (!code) return;
    if (session) {
      // Сессия уже подгружена (из LobbyPage). Просто убеждаемся, что WS подключён.
      wsClient.connect(session.id);
      return;
    }
    loadByCode(code)
      .then(() => {
        const loaded = useSessionStore.getState().session;
        if (loaded) wsClient.connect(loaded.id);
      })
      .catch((err) => {
        logger.warn('api.nonfatal_failure', 'Failed to hydrate story page session', {
          reason: err instanceof Error ? err.message : String(err),
          code,
        });
      });
  }, [code, session, loadByCode]);

  // Нехост переходит в игру, как только гейм-стор получил мою роль по WS.
  useEffect(() => {
    if (!myRole || isHost || !session || navigatingRef.current) return;
    navigatingRef.current = true;
    navigate(`/game/${session.id}`);
  }, [myRole, isHost, session, navigate]);

  // Авто-переход из фазы показа сюжета в выбор имени.
  useEffect(() => {
    if (phase !== 'story') return;
    setSelectedStory(CLASSIC_STORY.id);
    const t = setTimeout(() => setPhase('name-pick'), STORY_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [phase, setSelectedStory]);

  // Таймер фазы выбора имени (локальный, синхронизация не критична — все клиенты
  // вошли на страницу практически одновременно в ответ на story_phase_started).
  useEffect(() => {
    if (phase !== 'name-pick') return;
    setNameTimer(NAME_PICK_DURATION_SECONDS);
    const interval = setInterval(() => {
      setNameTimer((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    const unsubscribe = subscribeAudioPreload(setAudioPreloadProgress);

    sessionApi.getAudioPreloadStatus(session.id)
      .then((response) => {
        if (!cancelled) {
          setAudioPreloadStatus(response.data);
        }
      })
      .catch((err) => {
        logger.warn('api.nonfatal_failure', 'Failed to load audio preload status', {
          reason: err instanceof Error ? err.message : String(err),
          sessionId: session.id,
        }, { sessionId: session.id });
      });

    preloadNarrationAudio()
      .then(async (result) => {
        if (cancelled || result.failed > 0) return;
        const response = await sessionApi.markAudioPreloadReady(session.id, {
          manifest_version: AUDIO_PRELOAD_MANIFEST_VERSION,
        });
        if (!cancelled) {
          setAudioPreloadStatus(response.data);
        }
      })
      .catch((err) => {
        logger.warn('api.nonfatal_failure', 'Audio preload failed', {
          reason: err instanceof Error ? err.message : String(err),
          sessionId: session.id,
        }, { sessionId: session.id });
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [players.length, session, setAudioPreloadStatus]);

  const audioPlayersTotal = audioPreloadStatus?.players_total ?? players.length;
  const audioReadyCount = audioPreloadStatus?.ready_count ?? 0;
  const localAudioReady = audioPreloadProgress.done && audioPreloadProgress.failed === 0;
  const audioReadyForGame = audioPreloadStatus
    ? localAudioReady && (!audioPreloadStatus.required || audioReadyCount >= audioPlayersTotal)
    : audioPreloadProgress.total === 0;
  const audioProgressTotal = Math.max(1, audioPreloadProgress.total);
  const audioPreloadPercent = Math.min(
    100,
    Math.round(((audioPreloadProgress.loaded + audioPreloadProgress.failed) / audioProgressTotal) * 100),
  );
  const audioStatusText = audioPreloadProgress.failed > 0
    ? `Ошибка загрузки озвучки: ${audioPreloadProgress.failed}`
    : !localAudioReady
      ? `Загрузка озвучки ${audioPreloadProgress.loaded}/${audioPreloadProgress.total}`
      : audioReadyForGame
        ? `Озвучка готова ${audioReadyCount}/${audioPlayersTotal}`
        : `Ожидание игроков ${audioReadyCount}/${audioPlayersTotal}`;

  // По истечению таймера хост автоматически запускает игру. Нехосты ждут
  // game_started/role_assigned WS-события.
  useEffect(() => {
    if (phase !== 'name-pick') return;
    if (nameTimer > 0) return;
    if (!isHost) return;
    if (!audioReadyForGame) return;
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void handleStartGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioReadyForGame, nameTimer, phase, isHost]);

  const me = players.find((p) => p.id === myPlayerId) ?? null;
  const myName = me?.name ?? '';
  const occupiedByOthers = new Set(
    players.filter((p) => p.id !== myPlayerId).map((p) => p.name),
  );

  const handlePickName = async (name: string) => {
    if (occupiedByOthers.has(name) || name === myName || pendingName !== null) {
      return;
    }
    setPendingName(name);
    setRenameError(null);
    try {
      await setMyName(name);
      logger.info('story.name_picked', 'Player picked name', {
        sessionId: session?.id,
        name,
      }, { sessionId: session?.id });
    } catch (err) {
      logger.warn('api.nonfatal_failure', 'Set name failed', {
        reason: err instanceof Error ? err.message : String(err),
      });
      setRenameError(getApiErrorMessage(err));
    } finally {
      setPendingName(null);
    }
  };

  const handleStartGame = async () => {
    if (!session || !isHost) return;
    if (!audioReadyForGame) return;
    setStarting(true);
    setStartError(null);
    try {
      setSelectedStory(CLASSIC_STORY.id);
      await gameApi.start(session.id);
      logger.info('story.selection_completed', 'Host started game after story phase', {
        sessionId: session.id,
      }, { sessionId: session.id });
      navigatingRef.current = true;
      navigate(`/game/${session.id}`);
    } catch (err) {
      logger.warn('api.nonfatal_failure', 'Failed to start game', {
        reason: err instanceof Error ? err.message : String(err),
        sessionId: session.id,
      }, { sessionId: session.id });
      setStartError(getApiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="story-page">
      <GameScreenHeader
        title={phase === 'story' ? 'Сюжет' : 'Выбор персонажа'}
        showPause={false}
        pauseSlot={<span className="story-header__spacer" />}
        timer={phase === 'name-pick' ? <Timer seconds={nameTimer} dangerThreshold={10} /> : undefined}
      />

      <main className="story-main">
        {phase === 'story' && (
          <div className="story-result">
            <Badge variant="default" size="md" className="story-result__badge">
              Сюжет
            </Badge>
            <div className="story-result__card">
              <div className="story-result__placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M6 21v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                </svg>
              </div>
              <span className="story-result__title">{CLASSIC_STORY.title}</span>
            </div>
            <p className="story-result__desc">{CLASSIC_STORY.description}</p>
          </div>
        )}

        {phase === 'name-pick' && (
          <div className="story-name-pick">
            <p className="story-name-pick__hint">
              Выберите своё имя. Имена используются ведущим в озвучке.
            </p>
            <div className="story-name-pick__current">
              <span className="story-name-pick__current-label">Вы играете как:</span>
              <span className="story-name-pick__current-name">{myName || '—'}</span>
            </div>
            <div className="story-name-pick__audio">
              <div className="story-name-pick__audio-row">
                <span>{audioStatusText}</span>
                <span>{audioPreloadPercent}%</span>
              </div>
              <div className="story-name-pick__audio-track">
                <span style={{ width: `${audioPreloadPercent}%` }} />
              </div>
            </div>
            <div className="story-name-pick__grid">
              {NAMES.map((n) => {
                const isMine = n.display === myName;
                const isTaken = occupiedByOthers.has(n.display);
                const isLoading = pendingName === n.display;
                const cls = [
                  'story-name-pick__name',
                  isMine && 'story-name-pick__name--mine',
                  isTaken && 'story-name-pick__name--taken',
                  isLoading && 'story-name-pick__name--loading',
                ]
                  .filter(Boolean)
                  .join(' ');
                const description = getCharacterDescription(n.display);
                return (
                  <button
                    key={n.display}
                    type="button"
                    className={cls}
                    disabled={isTaken || isLoading || isMine}
                    onClick={() => handlePickName(n.display)}
                  >
                    <div className="story-name-pick__name-head">
                      <span className="story-name-pick__name-text">{n.display}</span>
                      <span className="story-name-pick__name-gender">
                        {n.gender === 'f' ? '♀' : '♂'}
                      </span>
                    </div>
                    {description && (
                      <p className="story-name-pick__name-desc">{description}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {renameError && (
              <Alert variant="error" compact>
                {renameError}
              </Alert>
            )}

            <div className="story-name-pick__players">
              <h4 className="story-name-pick__players-title">Игроки в лобби</h4>
              <ul className="story-name-pick__players-list">
                {players.map((p) => (
                  <li
                    key={p.id}
                    className={`story-name-pick__player${
                      p.id === myPlayerId ? ' story-name-pick__player--me' : ''
                    }`}
                  >
                    <span className="story-name-pick__player-name">{p.name}</span>
                    {p.is_host && (
                      <span className="story-name-pick__player-tag">хост</span>
                    )}
                    {p.id === myPlayerId && (
                      <span className="story-name-pick__player-tag story-name-pick__player-tag--me">вы</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {startError && (
              <Alert variant="error" compact>
                {startError}
              </Alert>
            )}

            <div className="story-action">
              {isHost ? (
                <Button
                  onClick={handleStartGame}
                  disabled={!myName || starting || !audioReadyForGame || audioPreloadProgress.failed > 0}
                  loading={starting}
                >
                  {starting
                    ? 'Запуск...'
                    : audioPreloadProgress.failed > 0
                      ? 'Ошибка загрузки озвучки'
                      : !audioReadyForGame
                        ? audioStatusText
                        : 'Начать игру'}
                </Button>
              ) : (
                <p className="story-name-pick__waiting">
                  {!audioReadyForGame
                    ? audioStatusText
                    : myName
                    ? 'Имя выбрано. Ожидание хоста...'
                    : 'Выберите своё имя'}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
