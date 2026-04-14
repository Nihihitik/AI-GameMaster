import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GamePage from './GamePage';
import { useGameStore } from '../stores/gameStore';
import { useSessionStore } from '../stores/sessionStore';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ sessionId: 'session-1' }),
}), { virtual: true });

jest.mock('../api/wsClient', () => ({
  wsClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

describe('GamePage role reveal progress', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useSessionStore.getState().reset();

    useSessionStore.setState({
      timerPaused: false,
      settings: {
        role_reveal_timer_seconds: 15,
        discussion_timer_seconds: 120,
        voting_timer_seconds: 60,
        night_action_timer_seconds: 30,
        role_config: {
          mafia: 1,
          don: 0,
          sheriff: 1,
          doctor: 1,
          lover: 0,
          maniac: 0,
        },
      },
    });

    useGameStore.setState({
      screen: 'role_reveal',
      myRole: {
        slug: 'civilian',
        name: 'Мирный житель',
        team: 'city',
        abilities: { night_action: null },
      },
      acknowledged: false,
      acknowledgedCount: 2,
      totalPlayers: 5,
      phase: {
        id: 'phase-1',
        type: 'role_reveal',
        number: 0,
        sub_phase: null,
        started_at: new Date().toISOString(),
        timer_seconds: 15,
        timer_started_at: new Date().toISOString(),
      },
      loadState: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('shows the shared X/N counter even before local acknowledgement', async () => {
    render(<GamePage />);

    await waitFor(() => {
      expect(screen.getByText('Ознакомились с ролями')).toBeInTheDocument();
    });

    const card = document.querySelector('.role-card');
    expect(card).not.toBeNull();
    if (card) {
      fireEvent.click(card);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ознакомлен' })).toBeInTheDocument();
    });

    const progressLabel = screen.getByText('Ознакомились с ролями');
    expect(progressLabel.parentElement).toHaveTextContent('2/5');
  });
});
