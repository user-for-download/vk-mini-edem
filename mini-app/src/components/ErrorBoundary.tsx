import React from 'react';
import { View, Panel, Placeholder, Button } from '@vkontakte/vkui';
import * as Sentry from '@sentry/react';
import { AppPanelHeader } from './AppPanelHeader';

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
        <View activePanel="error">
          <Panel id="error">
            <AppPanelHeader>Ошибка</AppPanelHeader>
            <Placeholder
              title="Что-то пошло не так"
              action={
                <Button size="m" onClick={() => window.location.reload()}>
                  Перезагрузить страницу
                </Button>
              }
            >
              К сожалению, произошла непредвиденная ошибка.
            </Placeholder>
          </Panel>
        </View>
      );
    }

    return this.props.children;
  }
}
