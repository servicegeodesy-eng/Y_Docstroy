import { Component, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorLocation: string | null;
}

class ErrorBoundaryInner extends Component<Props & { location: string }, State> {
  state: State = { hasError: false, error: null, errorLocation: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    props: Props & { location: string },
    state: State
  ): Partial<State> | null {
    // Сброс ошибки при навигации на другую страницу
    if (state.hasError && state.errorLocation && props.location !== state.errorLocation) {
      return { hasError: false, error: null, errorLocation: null };
    }
    return null;
  }

  componentDidCatch() {
    // Запоминаем URL, на котором произошла ошибка
    this.setState({ errorLocation: this.props.location });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorLocation: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
          <div
            className="ds-card p-6 max-w-md text-center"
            style={{ borderColor: "var(--ds-accent)" }}
          >
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--ds-text)" }}>
              Произошла ошибка
            </h2>
            <p
              className="text-sm mb-4 break-words"
              style={{ color: "var(--ds-text-muted)" }}
            >
              {this.state.error?.message || "Неизвестная ошибка"}
            </p>
            <button className="ds-btn" onClick={this.handleReset}>
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children, fallback }: Props) {
  const location = useLocation();
  return (
    <ErrorBoundaryInner location={location.pathname} fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  );
}
