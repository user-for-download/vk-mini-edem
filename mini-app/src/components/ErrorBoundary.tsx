import React from 'react';
import * as Sentry from '@sentry/react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="RootError" role="alert">
          <div className="RootError__content">
            <h1>Что-то пошло не так</h1>
            <p>К сожалению, произошла непредвиденная ошибка.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
