import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import StorySelectionPage from './pages/StorySelectionPage';
import GamePage from './pages/GamePage';
import ProfilePage from './pages/ProfilePage';
import Loader from './components/ui/Loader';
import AppErrorBoundary from './components/app/AppErrorBoundary';
import { useAuthStore } from './stores/authStore';
import { logger } from './services/logger';
import './App.scss';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Data router (createBrowserRouter) обязателен для useBlocker в react-router-dom v7.
// Обычный <BrowserRouter> / <Routes> — legacy, useBlocker в нём бросает invariant.
const router = createBrowserRouter([
  { path: '/auth', element: <AuthPage /> },
  { path: '/', element: <ProtectedRoute><HomePage /></ProtectedRoute> },
  { path: '/profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
  { path: '/sessions/:code', element: <ProtectedRoute><LobbyPage /></ProtectedRoute> },
  { path: '/sessions/:code/stories', element: <ProtectedRoute><StorySelectionPage /></ProtectedRoute> },
  { path: '/game/:sessionId', element: <ProtectedRoute><GamePage /></ProtectedRoute> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function AppBootstrap() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  useEffect(() => {
    initialize().catch((error) => {
      logger.error('app.bootstrap_failed', 'App bootstrap initialization failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }, [initialize]);

  if (isInitializing) {
    return (
      <div className="app-bootstrap">
        <Loader size={56} />
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}

function App() {
  return <AppBootstrap />;
}

export default App;
