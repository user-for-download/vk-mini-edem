import React from "react";
import { Placeholder, Button } from "@vkontakte/vkui";
import * as Sentry from "@sentry/react";

/**
 * Локальный error boundary для отдельного View.
 * Позволяет не ронять всё приложение из-за ошибки в одной панели:
 * пользователь видит заглушку и может перезагрузить только этот экран.
 */
export class ViewErrorBoundary extends React.Component<
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
    console.error("View error:", error, errorInfo);

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

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Placeholder
          title="Не удалось загрузить экран"
          action={
            <Button size="m" onClick={this.reset}>
              Попробовать снова
            </Button>
          }
        >
          Произошла ошибка при отображении этого раздела.
        </Placeholder>
      );
    }

    return this.props.children;
  }
}