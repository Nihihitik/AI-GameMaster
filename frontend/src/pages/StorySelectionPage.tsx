import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import Badge from '../components/ui/Badge';
import Timer from '../components/ui/Timer';
import WaitingBlock from '../components/ui/WaitingBlock';
import GameScreenHeader from '../components/game/GameScreenHeader';
import { useSessionStore } from '../stores/sessionStore';
import { mockStories } from '../mocks/sessionMocks';
import { useCountdown } from '../hooks/useCountdown';
import { logger } from '../services/logger';
import { usePageViewLogger } from '../hooks/usePageViewLogger';
import './StorySelectionPage.scss';

type Phase = 'voting' | 'waiting' | 'revealing' | 'done';

export default function StorySelectionPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [votedCount, setVotedCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('voting');
  const [revealIndex, setRevealIndex] = useState(0);
  const [winnerStory, setWinnerStory] = useState<typeof mockStories[0] | null>(null);

  const session = useSessionStore((s) => s.session);
  const players = useSessionStore((s) => s.players);
  const timerPaused = useSessionStore((s) => s.timerPaused);
  const setSelectedStory = useSessionStore((s) => s.setSelectedStory);

  const total = players.length || 8;
  usePageViewLogger('StorySelectionPage', { sessionId: session?.id ?? null });
  const hasAutoConfirmedRef = useRef(false);
  const timeLeft = useCountdown({
    enabled: phase === 'voting',
    paused: timerPaused,
    fallbackSeconds: 60,
    timerSeconds: null,
    timerStartedAt: null,
    resetKey: phase,
  });

  useEffect(() => {
    if (phase !== 'voting' || timerPaused || timeLeft > 0 || hasAutoConfirmedRef.current) {
      return;
    }

    hasAutoConfirmedRef.current = true;
    const myVote = selectedId;
    if (myVote) {
      setVotes((prev) => ({ ...prev, [myVote]: (prev[myVote] || 0) + 1 }));
    }
    setVotedCount(1);
    setPhase('waiting');
  }, [phase, selectedId, timeLeft, timerPaused]);

  useEffect(() => {
    if (phase === 'voting' && timeLeft > 0) {
      hasAutoConfirmedRef.current = false;
    }
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== 'waiting') {
      return;
    }

    const mockTimers: ReturnType<typeof setTimeout>[] = [];
    const remaining = total - votedCount;
    for (let i = 0; i < remaining; i += 1) {
      mockTimers.push(
        setTimeout(() => {
          setVotedCount((count) => count + 1);
          const randomStory = mockStories[Math.floor(Math.random() * mockStories.length)];
          setVotes((prev) => ({
            ...prev,
            [randomStory.id]: (prev[randomStory.id] || 0) + 1,
          }));
        }, (i + 1) * 1200)
      );
    }

    return () => mockTimers.forEach(clearTimeout);
  }, [phase, total, votedCount]);

  useEffect(() => {
    if (phase !== 'waiting' || votedCount < total) {
      return;
    }

    const timer = setTimeout(() => {
      const maxVotes = Math.max(...Object.values(votes), 0);
      let candidates: typeof mockStories;

      if (maxVotes === 0) {
        candidates = [...mockStories];
      } else {
        const winIds = Object.entries(votes)
          .filter(([, value]) => value === maxVotes)
          .map(([id]) => id);
        candidates = mockStories.filter((story) => winIds.includes(story.id));
      }

      if (candidates.length === 1) {
        setWinnerStory(candidates[0]);
        setPhase('done');
        return;
      }

      setWinnerStory(candidates[Math.floor(Math.random() * candidates.length)]);
      setPhase('revealing');
      setRevealIndex(0);
    }, 800);

    return () => clearTimeout(timer);
  }, [phase, total, votedCount, votes]);

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

  const handleConfirmVote = () => {
    if (phase !== 'voting') return;
    const myVote = selectedId;
    logger.info('story.vote_submit', 'Story vote submitted', {
      sessionId: session?.id,
      selectedId: myVote,
    }, { sessionId: session?.id });
    if (myVote) {
      setVotes((prev) => ({ ...prev, [myVote]: (prev[myVote] || 0) + 1 }));
    }
    setVotedCount(1);
    setPhase('waiting');
  };

  const handleContinue = () => {
    if (winnerStory) {
      setSelectedStory(winnerStory.id);
      logger.info('story.selection_completed', 'Story selection completed', {
        sessionId: session?.id,
        storyId: winnerStory.id,
      }, { sessionId: session?.id });
    }
    if (session?.id) {
      navigate(`/game/${session.id}`);
    } else {
      navigate('/', { replace: true });
    }
  };

  const randomStoryForReveal = mockStories[revealIndex % mockStories.length];
  const isVotingPhase = phase === 'voting';

  return (
    <div className="story-page">
      <GameScreenHeader
        title="Выбор сюжета"
        showPause={isVotingPhase}
        pauseSlot={isVotingPhase ? undefined : <span className="story-header__spacer" />}
        timer={isVotingPhase ? <Timer seconds={timeLeft} dangerThreshold={10} /> : undefined}
        right={!isVotingPhase ? <div className="story-header__voted">{votedCount}/{total}</div> : undefined}
      />

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
            <Badge variant="default" size="md" className="story-result__badge">Выбранный сюжет</Badge>
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
              <WaitingBlock text={`Ожидание голосов: ${votedCount}/${total}`} loaderSize={32} />
            )}
          </>
        )}
      </main>

    </div>
  );
}
