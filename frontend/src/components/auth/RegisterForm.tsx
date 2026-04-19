import React, { useState } from 'react';
import Input from '../ui/Input';
import Button, { LinkButton } from '../ui/Button';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage } from '../../utils/getApiErrorMessage';
import { logger } from '../../services/logger';

interface RegisterFormProps {
  onToggle: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm({ onToggle }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Get individual store functions to prevent unnecessary re-renders
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setEmailError('');
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError('Некорректный формат email');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validateNickname = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setNicknameError('');
      return false;
    }
    if (trimmed.length < 1 || trimmed.length > 32) {
      setNicknameError('Никнейм должен быть от 1 до 32 символов');
      return false;
    }
    setNicknameError('');
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordError('');
      return false;
    }
    if (value.length < 8) {
      setPasswordError('Минимум 8 символов');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value) validateEmail(value);
    else setEmailError('');
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    if (value) validateNickname(value);
    else setNicknameError('');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value) validatePassword(value);
    else setPasswordError('');
  };

  const trimmedNickname = nickname.trim();

  const isFormValid =
    email.trim().length > 0 &&
    trimmedNickname.length >= 1 &&
    trimmedNickname.length <= 32 &&
    password.length > 0 &&
    password === passwordConfirm &&
    !emailError &&
    !nicknameError &&
    !passwordError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    const emailOk = validateEmail(email);
    const nicknameOk = validateNickname(nickname);
    const passOk = validatePassword(password);
    if (!emailOk || !nicknameOk || !passOk) return;

    setServerError(null);
    setLoading(true);
    logger.info('auth.register_submit', 'Submitting registration form');

    try {
      const { data } = await authApi.register({
        email: email.trim(),
        password,
        nickname: trimmedNickname,
      });
      setTokens(data.access_token, data.refresh_token, 'local');
      setUser({
        user_id: data.user_id,
        email: data.email,
        nickname: data.nickname,
        has_pro: false,
        created_at: new Date().toISOString(),
      });
      logger.info('auth.register_success', 'Registration succeeded', {
        userId: data.user_id,
      }, { userId: data.user_id });
      // AuthPage will handle redirect
    } catch (err) {
      logger.warn('api.nonfatal_failure', 'Registration failed', {
        reason: err instanceof Error ? err.message : String(err),
      });
      setServerError(getApiErrorMessage(err));
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
        onChange={handleEmailChange}
        error={emailError}
        autoComplete="email"
      />

      <Input
        type="text"
        label="Никнейм"
        value={nickname}
        onChange={handleNicknameChange}
        error={nicknameError}
        autoComplete="nickname"
      />

      <Input
        type="password"
        label="Пароль"
        value={password}
        onChange={handlePasswordChange}
        error={passwordError}
        autoComplete="new-password"
      />

      <Input
        type="password"
        label="Повторите пароль"
        value={passwordConfirm}
        onChange={setPasswordConfirm}
        autoComplete="new-password"
      />

      {serverError && <div className="auth-form__error">{serverError}</div>}

      <div className="auth-form__actions">
        <Button type="submit" disabled={!isFormValid} loading={loading}>
          Создать аккаунт
        </Button>
      </div>

      <p className="auth-form__subtitle">
        Присоединяйтесь к тысячам людей, которые уже играют с нами
      </p>

      <div className="auth-form__toggle" style={{ marginTop: '24px' }}>
        <LinkButton
          text="Уже есть аккаунт?"
          linkText="Войти"
          onClick={onToggle}
        />
      </div>
    </form>
  );
}
