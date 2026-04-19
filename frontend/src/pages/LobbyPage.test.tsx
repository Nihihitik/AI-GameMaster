import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LobbyPage from './LobbyPage';
import { useSessionStore } from '../stores/sessionStore';
import { useGameStore } from '../stores/gameStore';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ code: 'DEV123' }),
  useBlocker: () => ({ state: 'unblocked', proceed: jest.fn() }),
}), { virtual: true });

jest.mock('../api/wsClient', () => ({
  wsClient: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('../api/sessionApi', () => ({
  sessionApi: {
    close: jest.fn(),
    leave: jest.fn(),
  },
}));

jest.mock('../api/gameApi', () => ({
  gameApi: {
    start: jest.fn(),
  },
}));

jest.mock('../api/devApi', () => ({
  devApi: {
    expandTestLobby: jest.fn(),
  },
}));

describe('LobbyPage dev quick actions', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useGameStore.getState().reset();
    useSessionStore.getState().reset();
    useSessionStore.setState({
      session: {
        id: 'session-1',
        code: 'DEV123',
        host_user_id: 'user-1',
        player_count: 5,
        status: 'waiting',
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
          dev_test_lobby: true,
        },
        created_at: new Date().toISOString(),
        dev_lobby: {
          is_test_lobby: true,
          player_links: [
            { slot_number: 1, player_slug: 'player1', player_name: 'Host', url: '/sessions/DEV123' },
            { slot_number: 2, player_slug: 'player2', player_name: 'Player 2', url: '/sessions/DEV123/player2?devKey=secret-2' },
          ],
        },
      },
      players: [
        { id: 'player-1', name: 'Host', join_order: 1, is_host: true },
        { id: 'player-2', name: 'Player 2', join_order: 2, is_host: false },
      ],
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
        dev_test_lobby: true,
      },
      isHost: true,
      myPlayerId: 'player-1',
      withStory: false,
      loadByCode: jest.fn().mockResolvedValue(undefined),
      setSettings: jest.fn(),
      hydrateSessionDetail: jest.fn(),
    });
  });

  it('renders dev quick actions only for test lobbies and opens player tab', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(<LobbyPage />);

    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Тестовые игроки' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /player2/i }));

    expect(openSpy).toHaveBeenCalledWith(
      '/sessions/DEV123/player2?devKey=secret-2',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });

  it('does not render dev quick actions for regular lobbies', async () => {
    useSessionStore.setState((state) => ({
      ...state,
      session: state.session ? { ...state.session, dev_lobby: null } : state.session,
    }));

    render(<LobbyPage />);

    await waitFor(() => {
      expect(screen.getByText('Игроки')).toBeInTheDocument();
    });

    expect(screen.queryByRole('group', { name: 'Тестовые игроки' })).not.toBeInTheDocument();
  });
});
