import React from 'react';
import * as Sentry from '@sentry/react';
import { Button, Flex, Spacing } from '@vkontakte/vkui';

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
        <Flex direction="column" align="center" justify="center" style={{ textAlign: 'center', minHeight: '100vh' }}>
          <Spacing size={24} />
          <div>
            <Spacing size={8} />
            <h1>Что-то пошло не так</h1>
            <Spacing size={24} />
            <p>К сожалению, произошла непредвиденная ошибка.</p>
            <Spacing size={16} />
            <Button
              size="m"
              mode="primary"
              onClick={() => window.location.reload()}
            >
              Перезагрузить страницу
            </Button>
          </div>
        </Flex>
      );
    }

    return this.props.children;
  }
}