import React from 'react';
import Button from '../ui/Button';
import { logger } from '../../services/logger';

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('app.bootstrap_failed', 'Application error boundary caught an error', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '420px', textAlign: 'center' }}>
            <p>Приложение столкнулось с ошибкой.</p>
            <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
