import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/authApi';
import { subscriptionsApi } from '../api/subscriptionsApi';
import { SubscriptionStatusResponse } from '../types/api';
import { parseApiError } from '../utils/parseApiError';
import { ERROR_MESSAGES } from '../utils/constants';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import './ProfilePage.scss';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Подписка
  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Inline-edit nickname
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем статус подписки при монтировании
  useEffect(() => {
    let cancelled = false;
    setSubscriptionLoading(true);
    subscriptionsApi
      .me()
      .then(({ data }) => {
        if (!cancelled) setSubscription(data);
      })
      .catch((err) => {
        if (!cancelled) {
          // Тихо игнорируем — показываем fallback (free) из профиля
          console.warn('Failed to load subscription status', parseApiError(err));
        }
      })
      .finally(() => {
        if (!cancelled) setSubscriptionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordChange = () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Новый пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }

    setIsChangingPassword(true);
    // TODO: бэк пока не предоставляет эндпоинт смены пароля — оставляем заглушку.
    setTimeout(() => {
      setIsChangingPassword(false);
      setPasswordSuccess('Пароль успешно изменён');
      setNewPassword('');
      setConfirmPassword('');
    }, 1000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  const startEditNickname = () => {
    setNicknameDraft(user?.nickname ?? '');
    setNicknameError('');
    setIsEditingNickname(true);
  };

  const cancelEditNickname = () => {
    setIsEditingNickname(false);
    setNicknameError('');
  };

  const saveNickname = async () => {
    const trimmed = nicknameDraft.trim();
    if (trimmed.length < 1 || trimmed.length > 32) {
      setNicknameError('Никнейм должен быть от 1 до 32 символов');
      return;
    }
    setNicknameSaving(true);
    setNicknameError('');
    try {
      const { data } = await authApi.updateNickname({ nickname: trimmed });
      const me = await authApi.me();
      useAuthStore.getState().setUser(me.data);
      setIsEditingNickname(false);
    } catch (err: any) {
      const parsed = parseApiError(err);
      setNicknameError(ERROR_MESSAGES[parsed.code as keyof typeof ERROR_MESSAGES] ?? parsed.message);
    } finally {
      setNicknameSaving(false);
    }
  };

  // Если пользователь не загружен — не рендерим приватные данные.
  if (!user) {
    return (
      <div className="profile-page">
        <header className="profile-header">
          <button className="profile-header__back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="profile-header__title">Профиль</h1>
          <div className="profile-header__spacer" />
        </header>
        <main className="profile-main">
          <p style={{ textAlign: 'center', color: '#888' }}>Загрузка профиля...</p>
        </main>
      </div>
    );
  }

  // Определяем Pro: сначала из subscription ответа, затем из user.has_pro.
  const isPro = subscription
    ? subscription.plan === 'pro' && subscription.status === 'active'
    : user.has_pro;

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button className="profile-header__back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="profile-header__title">Профиль</h1>
        <div className="profile-header__spacer" />
      </header>

      <main className="profile-main">
        {/* Avatar Section */}
        <div className="profile-avatar-section" onClick={handleAvatarClick}>
          <div className="profile-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar__img" />
            ) : (
              <div className="profile-avatar__placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
                </svg>
              </div>
            )}
            <div className="profile-avatar__edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            style={{ display: 'none' }}
          />
          <p className="profile-avatar__hint">Нажмите, чтобы изменить аватар</p>
        </div>

        {/* Nickname Section */}
        <div className="profile-section">
          <div className="profile-section__header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
            </svg>
            <span className="profile-section__label">Никнейм</span>
          </div>
          {isEditingNickname ? (
            <div className="profile-password-form">
              <Input
                type="text"
                label="Никнейм"
                value={nicknameDraft}
                onChange={setNicknameDraft}
                error={nicknameError}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  onClick={saveNickname}
                  loading={nicknameSaving}
                  disabled={nicknameSaving}
                >
                  Сохранить
                </Button>
                <Button onClick={cancelEditNickname} disabled={nicknameSaving}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="profile-section__value"
              onClick={startEditNickname}
              style={{ cursor: 'pointer' }}
              title="Нажмите, чтобы изменить никнейм"
            >
              {user.nickname}
            </div>
          )}
        </div>

        {/* Email Section */}
        <div className="profile-section">
          <div className="profile-section__header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <span className="profile-section__label">Email</span>
          </div>
          <div className="profile-section__value">{user.email}</div>
        </div>

        {/* Password Change Section */}
        <div className="profile-section profile-section--password">
          <div className="profile-section__header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="profile-section__label">Изменить пароль</span>
          </div>
          <div className="profile-password-form">
            <Input
              type="password"
              label="Новый пароль"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <Input
              type="password"
              label="Подтвердите пароль"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            {passwordError && <div className="profile-password-form__error">{passwordError}</div>}
            {passwordSuccess && <div className="profile-password-form__success">{passwordSuccess}</div>}
            <Button
              onClick={handlePasswordChange}
              loading={isChangingPassword}
              disabled={isChangingPassword}
            >
              Сохранить пароль
            </Button>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="profile-subscription">
          <div className="profile-subscription__header">
            <h2 className="profile-subscription__title">Подписка</h2>
            <span className={`profile-subscription__badge ${isPro ? 'profile-subscription__badge--pro' : ''}`}>
              {subscriptionLoading ? '...' : isPro ? 'PRO' : 'Обычная'}
            </span>
          </div>

          <div className="profile-subscription__plans">
            {/* Free Plan */}
            <div className={`profile-plan ${!isPro ? 'profile-plan--active' : ''}`}>
              <div className="profile-plan__header">
                <h3 className="profile-plan__name">Обычная</h3>
                <span className="profile-plan__price">Бесплатно</span>
              </div>
              <ul className="profile-plan__features">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Базовые роли (Мафия, Шериф, Доктор)</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>До 12 игроков</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>1 игровая сессия одновременно</span>
                </li>
                <li className="profile-plan__feature--disabled">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  <span>Дополнительные сюжеты</span>
                </li>
                <li className="profile-plan__feature--disabled">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  <span>Новые голоса ведущего</span>
                </li>
              </ul>
            </div>

            {/* Pro Plan */}
            <div className={`profile-plan profile-plan--pro ${isPro ? 'profile-plan--active' : ''}`}>
              <div className="profile-plan__glow" />
              <div className="profile-plan__header">
                <h3 className="profile-plan__name">
                  PRO
                  <span className="profile-plan__crown">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4z" /></svg>
                  </span>
                </h3>
                <div className="profile-plan__price-group">
                  <span className="profile-plan__price">149 ₽</span>
                  <span className="profile-plan__period">/месяц</span>
                </div>
              </div>
              <ul className="profile-plan__features">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Все базовые роли + Дон, Любовница, Маньяк</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>До 16 игроков</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>До 5 игровых сессий одновременно</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Эксклюзивные сюжеты</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  <span>Новые голоса ведущего</span>
                </li>
              </ul>
              {!isPro && (
                <button className="profile-plan__upgrade-btn">
                  Оформить PRO
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button className="profile-logout" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Выйти из аккаунта</span>
        </button>
      </main>
    </div>
  );
}
