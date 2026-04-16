import React, { useState } from 'react';
import Input from '../ui/Input';
import Button, { LinkButton } from '../ui/Button';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage } from '../../utils/getApiErrorMessage';
import { logger } from '../../services/logger';

interface LoginFormProps {
  onToggle: () => void;
}

export default function LoginForm({ onToggle }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Get individual store functions to prevent unnecessary re-renders
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setError(null);
    setLoading(true);
    logger.info('auth.login_submit', 'Submitting login form');

    try {
      const { data } = await authApi.login({ email: email.trim(), password });
      setTokens(data.access_token, data.refresh_token);
      setUser({
        user_id: data.user_id,
        email: data.email,
        nickname: data.nickname,
        has_pro: false,
        created_at: new Date().toISOString(),
      });
      logger.info('auth.login_success', 'Login succeeded', {
        userId: data.user_id,
      }, { userId: data.user_id });
      // AuthPage will handle redirect
    } catch (err) {
      logger.warn('api.nonfatal_failure', 'Login failed', {
        reason: err instanceof Error ? err.message : String(err),
      });
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <Input
        type="email"
        label="Email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />

      <Input
        type="password"
        label="Пароль"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      {error && <div className="auth-form__error">{error}</div>}

      <div className="auth-form__actions">
        <Button type="submit" disabled={!isFormValid} loading={loading}>
          Войти
        </Button>
      </div>

      <p className="auth-form__subtitle">
        Присоединяйтесь к тысячам людей, которые уже играют с нами
      </p>

      <div className="auth-form__toggle">
        <LinkButton
          text="Нет аккаунта?"
          linkText="Создать"
          onClick={onToggle}
        />
      </div>
    </form>
  );
}
