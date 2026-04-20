import React, { useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

interface PasswordChangeFormProps {
  onSubmit?: (newPassword: string) => Promise<void>;
  minLength?: number;
}

// Form-only component: validation + UI state live here; the caller provides
// an async onSubmit to wire it up to a real backend. Без onSubmit форма работает
// как mock (setTimeout) — полезно для showcase и временного UI пока бэк не готов.
export default function PasswordChangeForm({
  onSubmit,
  minLength = 6,
}: PasswordChangeFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (newPassword.length < minLength) {
      setError(`Новый пароль должен содержать минимум ${minLength} символов`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(newPassword);
      } else {
        // Backend-заглушка пока нет эндпоинта.
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setSuccess('Пароль успешно изменён');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
      {error && <Alert variant="error" compact>{error}</Alert>}
      {success && <Alert variant="success" compact>{success}</Alert>}
      <Button
        onClick={handleSubmit}
        loading={submitting}
        disabled={submitting}
      >
        Сохранить пароль
      </Button>
    </div>
  );
}
