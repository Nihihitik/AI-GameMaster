import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Loader from '../components/ui/Loader';
import { devApi } from '../api/devApi';
import { useAuthStore } from '../stores/authStore';
import { getApiErrorMessage } from '../utils/getApiErrorMessage';
import { logger } from '../services/logger';

export default function DevPlayerBootstrapPage() {
  const { code, playerSlug } = useParams<{ code: string; playerSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || !playerSlug) {
      navigate('/', { replace: true });
      return;
    }

    const devKey = searchParams.get('devKey');
    if (!devKey) {
      setError('Ссылка игрока неполная');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data } = await devApi.activatePlayer({
          code,
          player_slug: playerSlug,
          bootstrap_key: devKey,
        });
        if (cancelled) {
          return;
        }
        setTokens(data.access_token, data.refresh_token, 'session');
        setUser(data.user);
        navigate(`/sessions/${code}`, { replace: true });
      } catch (err) {
        if (cancelled) {
          return;
        }
        logger.warn('dev.player_bootstrap_failed', 'Failed to bootstrap dev player tab', {
          reason: err instanceof Error ? err.message : String(err),
          code,
          playerSlug,
        });
        setError(getApiErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, playerSlug, searchParams, setTokens, setUser]);

  if (error) {
    return (
      <div className="game-error">
        <p>{error}</p>
        <Button onClick={() => navigate('/', { replace: true })}>На главную</Button>
      </div>
    );
  }

  return (
    <div className="game-loading">
      <Loader size={48} />
    </div>
  );
}
