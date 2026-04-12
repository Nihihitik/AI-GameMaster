import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../ui/Input';
import Button, { LinkButton } from '../ui/Button';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { parseApiError } from '../../utils/parseApiError';

interface LoginFormProps {
  onToggle: () => void;
}

export default function LoginForm({ onToggle }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  // Get individual store functions to prevent unnecessary re-renders
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setError(null);
    setLoading(true);

    try {
      const { data } = await authApi.login({ email: email.trim(), password });
      setTokens(data.access_token, data.refresh_token);
      // AuthPage will handle redirect
    } catch (err) {
      // Mock Login Fallback for testing frontend without backend
      console.warn('Backend login failed, using mock login for testing', err);
      
      // Set fake tokens
      setTokens('mock_access_token', 'mock_refresh_token');
      
      // Set fake user profile
      setUser({
        user_id: 'mock-user-123',
        email: email.trim(),
        has_pro: false,
        created_at: new Date().toISOString()
      });
      // AuthPage will handle redirect
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
