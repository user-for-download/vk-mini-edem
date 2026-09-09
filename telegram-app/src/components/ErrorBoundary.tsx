import { Component, type ComponentType, type PropsWithChildren } from "react";

/**
 * Минимальный ErrorBoundary (паттерн reactjs-template): ловит краши ниже
 * AppRoot/telegram-ui. Fallback — чистый HTML без UI-кита, чтобы ошибка
 * в самом UI-ките не уронила экран ошибки.
 */
interface ErrorBoundaryProps {
  fallback: ComponentType<{ error: unknown }>;
}

interface ErrorBoundaryState {
  error: unknown | null;
}

class ErrorBoundaryInner extends Component<
  PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

export function ErrorBoundary(props: PropsWithChildren<ErrorBoundaryProps>) {
  return <ErrorBoundaryInner {...props} />;
}
