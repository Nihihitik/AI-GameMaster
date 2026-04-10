import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useSessionStore } from '../stores/sessionStore';
import './HomePage.scss';

export default function HomePage() {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code');

  const navigate = useNavigate();
  const createSession = useSessionStore((s) => s.createSession);
  const joinSession = useSessionStore((s) => s.joinSession);

  const handleCreateSession = () => {
    createSession();
    const code = useSessionStore.getState().session?.code;
    if (code) {
      navigate(`/sessions/${code}`);
    }
  };

  const handleJoinSubmit = () => {
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

    joinSession(joinCode.trim().toUpperCase(), joinName.trim());
    setShowJoinModal(false);
    setJoinCode('');
    setJoinName('');
    setJoinStep('code');
    setJoinError('');
    navigate(`/sessions/${joinCode.trim().toUpperCase()}`);
  };

  const handleCloseJoinModal = () => {
    setShowJoinModal(false);
    setJoinCode('');
    setJoinName('');
    setJoinStep('code');
    setJoinError('');
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header__left">
          <img src="/img/logo.png" alt="Logo" className="home-header__logo" />
          <span className="home-header__title">MafiaMaster</span>
        </div>
        <button className="home-header__profile" aria-label="Профиль">
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

        <div className="home-actions">
          <Button onClick={handleCreateSession}>Создать сессию</Button>
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
            <Button onClick={handleJoinSubmit}>
              {joinStep === 'code' ? 'Далее' : 'Присоединиться'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
