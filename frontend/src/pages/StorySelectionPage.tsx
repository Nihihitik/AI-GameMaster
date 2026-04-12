import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import Loader from '../components/ui/Loader';
import { useSessionStore } from '../stores/sessionStore';
import { mockStories } from '../mocks/sessionMocks';
import './StorySelectionPage.scss';

type Phase = 'voting' | 'waiting' | 'revealing' | 'done';

export default function StorySelectionPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailStory, setDetailStory] = useState<typeof mockStories[0] | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [votedCount, setVotedCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('voting');
  const [revealIndex, setRevealIndex] = useState(0);
  const [winnerStory, setWinnerStory] = useState<typeof mockStories[0] | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);

  const session = useSessionStore((s) => s.session);
  const players = useSessionStore((s) => s.players);
  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setTimerPaused = useSessionStore((s) => s.setTimerPaused);
  const setSelectedStory = useSessionStore((s) => s.setSelectedStory);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = players.length || 8;

  useEffect(() => {
    if (phase !== 'voting' || timerPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handleConfirmVote();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timerPaused]);

  useEffect(() => {
    if (phase === 'waiting') {
      const mockTimers: ReturnType<typeof setTimeout>[] = [];
      const remaining = total - votedCount;
      for (let i = 0; i < remaining; i++) {
        mockTimers.push(
          setTimeout(() => {
            setVotedCount((c) => c + 1);
            const randomStory = mockStories[Math.floor(Math.random() * mockStories.length)];
            setVotes((prev) => ({
              ...prev,
              [randomStory.id]: (prev[randomStory.id] || 0) + 1,
            }));
          }, (i + 1) * 1200)
        );
      }
      return () => mockTimers.forEach(clearTimeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'waiting' && votedCount >= total) {
      const timer = setTimeout(() => resolveWinner(), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votedCount, phase]);

  useEffect(() => {
    if (phase !== 'revealing') return;
    if (revealIndex < 8) {
      const timer = setTimeout(() => {
        setRevealIndex((i) => i + 1);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setPhase('done'), 600);
      return () => clearTimeout(timer);
    }
  }, [phase, revealIndex]);

  const handleToggleVote = (storyId: string) => {
    if (phase !== 'voting') return;
    if (selectedId === storyId) {
      setSelectedId(null);
    } else {
      setSelectedId(storyId);
    }
  };

  const handleConfirmVote = useCallback(() => {
    if (phase !== 'voting') return;
    const myVote = selectedId;
    if (myVote) {
      setVotes((prev) => ({ ...prev, [myVote]: (prev[myVote] || 0) + 1 }));
    }
    setVotedCount(1);
    setPhase('waiting');
  }, [phase, selectedId]);

  const resolveWinner = () => {
    const maxVotes = Math.max(...Object.values(votes), 0);
    let candidates: typeof mockStories;

    if (maxVotes === 0) {
      candidates = [...mockStories];
    } else {
      const winIds = Object.entries(votes)
        .filter(([, v]) => v === maxVotes)
        .map(([id]) => id);
      candidates = mockStories.filter((s) => winIds.includes(s.id));
    }

    if (candidates.length === 1) {
      setWinnerStory(candidates[0]);
      setPhase('done');
    } else {
      setWinnerStory(candidates[Math.floor(Math.random() * candidates.length)]);
      setPhase('revealing');
      setRevealIndex(0);
    }
  };

  const handleContinue = () => {
    if (winnerStory) {
      setSelectedStory(winnerStory.id);
    }
    if (session?.id) {
      navigate(`/game/${session.id}`);
    } else {
      navigate('/', { replace: true });
    }
  };

  const togglePause = useCallback(() => {
    setTimerPaused(!timerPaused);
  }, [timerPaused, setTimerPaused]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const randomStoryForReveal = mockStories[revealIndex % mockStories.length];

  return (
    <div className="story-page">
      <header className="story-header">
        {phase === 'voting' ? (
          <button className="story-header__pause" onClick={togglePause}>
            {timerPaused ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            )}
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
        <h1 className="story-header__title">Выбор сюжета</h1>
        {phase === 'voting' ? (
          <div className={`story-header__timer ${timeLeft <= 10 ? 'story-header__timer--danger' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        ) : (
          <div className="story-header__voted">{votedCount}/{total}</div>
        )}
      </header>

      <main className="story-main">
        {phase === 'revealing' && (
          <div className="story-reveal">
            <p className="story-reveal__label">Выбираем сюжет...</p>
            <div className="story-reveal__card story-reveal__card--spinning">
              <div className="story-reveal__placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M6 21v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                </svg>
              </div>
              <span className="story-reveal__name">{randomStoryForReveal.title}</span>
            </div>
          </div>
        )}

        {phase === 'done' && winnerStory && (
          <div className="story-result">
            <div className="story-result__badge">Выбранный сюжет</div>
            <div className="story-result__card">
              <div className="story-result__placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M6 21v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                </svg>
              </div>
              <span className="story-result__title">{winnerStory.title}</span>
            </div>
            <p className="story-result__desc">{winnerStory.description}</p>
            <Button onClick={handleContinue}>Продолжить</Button>
          </div>
        )}

        {(phase === 'voting' || phase === 'waiting') && (
          <>
            <div className="story-grid">
              {mockStories.map((story) => (
                <div
                  key={story.id}
                  className={`story-card ${selectedId === story.id ? 'story-card--selected' : ''}`}
                  onClick={() => handleToggleVote(story.id)}
                >
                  <div className="story-card__placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="12" cy="10" r="3" />
                      <path d="M6 21v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
                    </svg>
                  </div>
                  <div className="story-card__footer">
                    <span className="story-card__title">{story.title}</span>
                    <span className="story-card__votes">
                      {votes[story.id] || 0}/{total}
                    </span>
                  </div>
                  <div className="story-card__check" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedId === story.id}
                      onChange={() => handleToggleVote(story.id)}
                      disabled={phase !== 'voting'}
                    />
                  </div>
                </div>
              ))}
            </div>

            {phase === 'voting' && (
              <div className="story-action">
                <Button onClick={handleConfirmVote}>
                  {selectedId ? 'Подтвердить выбор' : 'Пропустить голосование'}
                </Button>
              </div>
            )}

            {phase === 'waiting' && (
              <div className="story-waiting">
                <Loader size={32} />
                <p className="story-waiting__text">
                  Ожидание голосов: {votedCount}/{total}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <Modal
        isOpen={!!detailStory}
        onClose={() => setDetailStory(null)}
        title={detailStory?.title}
      >
        {detailStory && (
          <div className="story-detail">
            <div className="story-detail__placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="12" cy="10" r="3" />
                <path d="M6 21v-1a4 4 0 014-4h4a4 4 0 014 4v1" />
              </svg>
            </div>
            <p className="story-detail__desc">{detailStory.description}</p>
            <Button onClick={() => {
              handleToggleVote(detailStory.id);
              setDetailStory(null);
            }}>
              {selectedId === detailStory.id ? 'Убрать голос' : 'Голосовать'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
