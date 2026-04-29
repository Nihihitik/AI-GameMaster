import React, { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, type RouteObject } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import LobbyPage from './pages/LobbyPage';
import StorySelectionPage from './pages/StorySelectionPage';
import GamePage from './pages/GamePage';
import ProfilePage from './pages/ProfilePage';
import DevPlayerBootstrapPage from './pages/DevPlayerBootstrapPage';
import Loader from './components/ui/Loader';
import AppErrorBoundary from './components/app/AppErrorBoundary';
import { useAuthStore } from './stores/authStore';
import { prepareAuthStorageFromLocation } from './utils/tokenStorage';
import { logger } from './services/logger';
import './App.scss';

// Dev-only UI showcase page. В production-build lazy-импорт dead-code-elim-ится
// благодаря NODE_ENV-гварду (Terser). `process.env.NODE_ENV` — единственный
// паттерн, который CRA/react-scripts надёжно распознаёт для tree-shaking.
let DevUiPage: React.LazyExoticComponent<React.ComponentType> | null = null;
if (process.env.NODE_ENV !== 'production') {
  DevUiPage = lazy(() => import('./pages/UiPage'));
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Data router (createBrowserRouter) обязателен для useBlocker в react-router-dom v7.
// Обычный <BrowserRouter> / <Routes> — legacy, useBlocker в нём бросает invariant.
const devRoutes: RouteObject[] = DevUiPage
  ? [
      {
        path: '/ui',
        element: (
          <Suspense fallback={<div className="app-bootstrap"><Loader size={48} /></div>}>
            <DevUiPage />
          </Suspense>
        ),
      },
    ]
  : [];

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/pricing', element: <PricingPage /> },
  { path: '/auth', element: <AuthPage /> },
  { path: '/app', element: <ProtectedRoute><HomePage /></ProtectedRoute> },
  { path: '/profile', element: <ProtectedRoute><ProfilePage /></ProtectedRoute> },
  { path: '/sessions/:code/:playerSlug', element: <DevPlayerBootstrapPage /> },
  { path: '/sessions/:code', element: <ProtectedRoute><LobbyPage /></ProtectedRoute> },
  { path: '/sessions/:code/stories', element: <ProtectedRoute><StorySelectionPage /></ProtectedRoute> },
  { path: '/game/:sessionId', element: <ProtectedRoute><GamePage /></ProtectedRoute> },
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]);

function AppBootstrap() {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      prepareAuthStorageFromLocation(window.location.pathname, window.location.search);
    }
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
