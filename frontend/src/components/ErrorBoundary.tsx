import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-body)',
          padding: '24px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={64} style={{ color: 'var(--color-danger)', marginBottom: '24px' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: '16px' }}>Something went wrong.</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred in the application.'}
          </p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
