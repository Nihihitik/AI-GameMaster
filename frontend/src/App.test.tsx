import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { useAuthStore } from './stores/authStore';

jest.mock('./pages/AuthPage', () => () => <div>AuthPage</div>);
jest.mock('./pages/HomePage', () => () => <div>HomePage</div>);
jest.mock('./pages/LobbyPage', () => () => <div>LobbyPage</div>);
jest.mock('./pages/StorySelectionPage', () => () => <div>StorySelectionPage</div>);
jest.mock('./pages/GamePage', () => () => <div>GamePage</div>);
jest.mock('./pages/ProfilePage', () => () => <div>ProfilePage</div>);
jest.mock('./components/ui/Loader', () => () => <div data-testid="loader">Loading</div>);

jest.mock('react-router-dom', () => ({
  createBrowserRouter: jest.fn(() => ({ id: 'router' })),
  RouterProvider: ({ router }: { router: { id: string } }) => (
    <div data-testid="router-provider">{router.id}</div>
  ),
  Navigate: ({ to }: { to: string }) => <div>Navigate to {to}</div>,
}), { virtual: true });

describe('App', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isInitializing: false,
      setTokens: jest.fn(),
      setUser: jest.fn(),
      logout: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('calls auth bootstrap and renders router provider after initialization', async () => {
    render(<App />);

    await waitFor(() => {
      expect(useAuthStore.getState().initialize).toHaveBeenCalled();
    });

    expect(screen.getByTestId('router-provider')).toHaveTextContent('router');
  });

  it('shows bootstrap loader while auth store is initializing', () => {
    useAuthStore.setState({ isInitializing: true });

    render(<App />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('router-provider')).not.toBeInTheDocument();
  });
});
