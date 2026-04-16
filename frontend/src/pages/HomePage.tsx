import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Stepper from '../components/ui/Stepper';
import Slider from '../components/ui/Slider';
import { useSessionStore, MIN_PLAYERS, MAX_PLAYERS, getSpecialRolesCount, getCiviliansCount } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { RoleConfig } from '../types/game';
import { subscriptionsApi } from '../api/subscriptionsApi';
import { authApi } from '../api/authApi';
import { createDefaultSessionSettings } from '../utils/sessionDefaults';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { parseApiError } from '../utils/parseApiError';
import './HomePage.scss';

export default function HomePage() {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState('');

  const [playerCount, setPlayerCount] = useState(8);
  const [createSettings, setCreateSettings] = useState(() => createDefaultSessionSettings());
  const [hostName, setHostName] = useState('');

  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const specialCount = getSpecialRolesCount(createSettings.role_config);
  const civiliansCount = getCiviliansCount(playerCount, createSettings.role_config);

  const updateRoleConfig = (key: keyof RoleConfig, value: number) => {
    setCreateSettings((s) => ({
      ...s,
      role_config: { ...s.role_config, [key]: value },
    }));
  };

  const handleOpenCreate = () => {
    setCreateError('');
    setHostName(user?.nickname ?? '');
    setShowCreateModal(true);
  };

  const handleConfirmCreate = async () => {
    if (specialCount > playerCount) {
      setCreateError('Специальных ролей больше, чем игроков');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const trimmedHostName = hostName.trim();
      const code = await useSessionStore.getState().createSession({
        player_count: playerCount,
        settings: createSettings,
        host_name: trimmedHostName || undefined,
      });
      setShowCreateModal(false);
      navigate(`/sessions/${code}`);
    } catch (err) {
      if (parseApiError(err).code === 'pro_required') {
        setShowCreateModal(false);
        setShowProModal(true);
        return;
      }
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (joinStep === 'code') {
      if (joinCode.trim().length < 4) {
        setJoinError('Введите корректный код сессии');
        return;
      }
      setJoinError('');
      setJoinStep('name');
      return;
    }

    if (joinName.trim().length < 1) {
      setJoinError('Введите ваше имя');
      return;
    }

    const normalizedCode = joinCode.trim().toUpperCase();
    setJoining(true);
    setJoinError('');
    try {
      await useSessionStore.getState().joinSession(normalizedCode, joinName.trim());
      setShowJoinModal(false);
      setJoinCode('');
      setJoinName('');
      setJoinStep('code');
      setJoinError('');
      navigate(`/sessions/${normalizedCode}`);
    } catch (err) {
      setJoinError(getApiErrorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  const handleCloseJoinModal = () => {
    setShowJoinModal(false);
    setJoinCode('');
    setJoinName('');
    setJoinStep('code');
    setJoinError('');
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateError('');
  };

  const handleUpgradeToPro = async () => {
    setUpgrading(true);
    setUpgradeError('');
    try {
      await subscriptionsApi.create({ plan: 'pro' });
      const me = await authApi.me();
      useAuthStore.getState().setUser(me.data);
      setShowProModal(false);
      // Auto-retry session creation
      await handleConfirmCreate();
    } catch (err) {
      setUpgradeError(getApiErrorMessage(err));
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header__left">
          <img src="/img/logo.png" alt="Logo" className="home-header__logo" />
          <span className="home-header__title">MafiaMaster</span>
        </div>
        <button className="home-header__profile" aria-label="Профиль" onClick={() => navigate('/profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
          </svg>
        </button>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <img
            src="/img/На главную.png"
            alt="MafiaMaster"
            className="home-hero__image"
          />
        </div>

        <div className="home-tagline">
          <h2 className="home-tagline__title">Город засыпает. Мафия просыпается.</h2>
          <p className="home-tagline__subtitle">
            Создайте сессию и пригласите друзей для захватывающей партии в Мафию с AI-ведущим
          </p>
        </div>

        <div className="home-actions">
          <Button onClick={handleOpenCreate}>Создать сессию</Button>
          <div className="home-actions__spacer" />
          <button className="home-join-btn" onClick={() => setShowJoinModal(true)}>
            <span className="home-join-btn__glow" />
            <span className="home-join-btn__content">
              <span className="home-join-btn__text">Присоединиться к сессии</span>
            </span>
          </button>
        </div>
      </main>

      <Modal
        isOpen={showJoinModal}
        onClose={handleCloseJoinModal}
        title={joinStep === 'code' ? 'Введите код' : 'Ваше имя'}
      >
        <div className="join-modal">
          {joinStep === 'code' ? (
            <div className="join-modal__field">
              <p className="join-modal__hint">Введите код сессии, полученный от организатора</p>
              <Input
                label="Код сессии"
                value={joinCode}
                onChange={(v) => setJoinCode(v.toUpperCase())}
                error={joinError}
              />
            </div>
          ) : (
            <div className="join-modal__field">
              <p className="join-modal__hint">Как вас будут звать в игре?</p>
              <Input
                label="Имя игрока"
                value={joinName}
                onChange={setJoinName}
                error={joinError}
              />
            </div>
          )}
          <div className="join-modal__actions">
            <Button onClick={handleJoinSubmit} disabled={joining}>
              {joining ? 'Загрузка...' : joinStep === 'code' ? 'Далее' : 'Присоединиться'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        title="Создать сессию"
      >
        <div className="create-modal">
          <div className="create-modal__section">
            <h4 className="create-modal__section-title">Твоё имя в игре</h4>
            <Input
              label="Имя игрока"
              value={hostName}
              onChange={setHostName}
            />
          </div>

          <div className="create-modal__section">
            <h4 className="create-modal__section-title">Игроки</h4>
            <Slider
              label="Количество игроков"
              value={playerCount}
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              step={1}
              unit="чел"
              onChange={setPlayerCount}
            />
          </div>

          <div className="create-modal__section">
            <h4 className="create-modal__section-title">Таймеры</h4>
            <Slider
              label="Обсуждение"
              value={createSettings.discussion_timer_seconds}
              min={30}
              max={300}
              step={10}
              onChange={(v) => setCreateSettings((s) => ({ ...s, discussion_timer_seconds: v }))}
            />
            <Slider
              label="Голосование"
              value={createSettings.voting_timer_seconds}
              min={15}
              max={120}
              step={5}
              onChange={(v) => setCreateSettings((s) => ({ ...s, voting_timer_seconds: v }))}
            />
            <Slider
              label="Ночные действия"
              value={createSettings.night_action_timer_seconds}
              min={15}
              max={60}
              step={5}
              onChange={(v) => setCreateSettings((s) => ({ ...s, night_action_timer_seconds: v }))}
            />
            <Slider
              label="Ознакомление с ролью"
              value={createSettings.role_reveal_timer_seconds}
              min={10}
              max={30}
              step={1}
              onChange={(v) => setCreateSettings((s) => ({ ...s, role_reveal_timer_seconds: v }))}
            />
          </div>

          <div className="create-modal__section">
            <h4 className="create-modal__section-title">Роли</h4>
            <Stepper label="Мафия" value={createSettings.role_config.mafia} min={1} max={2}
              onChange={(v) => updateRoleConfig('mafia', v)} />
            <Stepper label="Дон Мафии" value={createSettings.role_config.don} min={0} max={1}
              onChange={(v) => updateRoleConfig('don', v)} />
            <Stepper label="Шериф" value={createSettings.role_config.sheriff} min={0} max={1}
              onChange={(v) => updateRoleConfig('sheriff', v)} />
            <Stepper label="Доктор" value={createSettings.role_config.doctor} min={0} max={1}
              onChange={(v) => updateRoleConfig('doctor', v)} />
            <Stepper label="Любовница" value={createSettings.role_config.lover} min={0} max={1}
              onChange={(v) => updateRoleConfig('lover', v)} />
            <Stepper label="Маньяк" value={createSettings.role_config.maniac} min={0} max={1}
              onChange={(v) => updateRoleConfig('maniac', v)} />

            <div className="create-modal__civilians">
              <span className="create-modal__civilians-label">Мирные жители</span>
              <span className="create-modal__civilians-count">{civiliansCount}</span>
            </div>
            <div className="create-modal__hint">В партии должна быть минимум 1 мафия.</div>
          </div>

          {createError && <div className="create-modal__error">{createError}</div>}

          <div className="create-modal__actions">
            <Button onClick={handleConfirmCreate} disabled={creating}>
              {creating ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showProModal}
        onClose={() => {
          setShowProModal(false);
          setUpgradeError('');
        }}
        title="Требуется подписка Pro"
      >
        <div className="pro-modal">
          <div className="pro-modal__benefits">
            <div className="pro-modal__benefit">
              <span className="pro-modal__benefit-icon">🆓</span>
              <span className="pro-modal__benefit-text">Бесплатно: до 12 игроков</span>
            </div>
            <div className="pro-modal__benefit pro-modal__benefit--highlight">
              <span className="pro-modal__benefit-icon">👑</span>
              <span className="pro-modal__benefit-text">Pro: до 16 игроков + новые роли (Дон, Любовница, Маньяк)</span>
            </div>
          </div>
          
          <div className="pro-modal__warning">
            <p>⚠️ Это dev-мокап — реальная оплата не проводится. Подписка Pro на 30 дней выдаётся бесплатно для тестирования.</p>
          </div>

          {upgradeError && <div className="pro-modal__error">{upgradeError}</div>}

          <div className="pro-modal__actions">
            <Button onClick={() => setShowProModal(false)} disabled={upgrading}>
              Отмена
            </Button>
            <Button onClick={handleUpgradeToPro} loading={upgrading}>
              Оформить Pro
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
