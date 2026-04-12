import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import StorySelectionPage from './pages/StorySelectionPage';
import GamePage from './pages/GamePage';
import ProfilePage from './pages/ProfilePage';
import { useAuthStore } from './stores/authStore';
import './App.scss';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/sessions/:code" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/sessions/:code/stories" element={<ProtectedRoute><StorySelectionPage /></ProtectedRoute>} />
        <Route path="/game/:sessionId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
