import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import MatrixBackground from '../components/ui/MatrixBackground';
import { useAuthStore } from '../stores/authStore';
import authHeroImage from '../assets/auth-hero.jpg';
import { usePageViewLogger } from '../hooks/usePageViewLogger';
import './AuthPage.scss';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [animKey, setAnimKey] = useState(0);
  
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  usePageViewLogger('AuthPage', { mode });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleToggle = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setAnimKey((k) => k + 1);
  };

  return (
    <div className="auth-page">
      <MatrixBackground />
      
      <div className="auth-page__content">
        <div className="auth-page__hero">
          <img
            src={authHeroImage}
            alt="Mafia Game"
            className="auth-page__hero-image"
          />
        </div>

        <div className="auth-form-container">
          <div className="auth-form-enter" key={animKey}>
            {mode === 'login' ? (
              <LoginForm onToggle={handleToggle} />
            ) : (
              <RegisterForm onToggle={handleToggle} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
