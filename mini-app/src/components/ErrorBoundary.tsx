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
      // Fallback БЕЗ VKUI-компонентов: ErrorBoundary — последний рубеж,
      // если упал сам AppRoot, рендерить VKUI-компоненты опасно (они могут
      // зависеть от контекста AppRoot). Используем чистый HTML + CSS-классы.
      return (
        <div className="ErrorBoundary">
          <h1 className="ErrorBoundary__title">Что-то пошло не так</h1>
          <p className="ErrorBoundary__message">
            К сожалению, произошла непредвиденная ошибка.
          </p>
          <button
            className="ErrorBoundary__reload"
            onClick={() => window.location.reload()}
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}