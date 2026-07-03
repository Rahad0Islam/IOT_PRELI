/**
 * ErrorBoundary — catches render errors and shows a soft fallback.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen grid place-items-center text-slate-300">
            <div className="card text-center">
              <h2 className="text-xl font-semibold mb-1">Something broke.</h2>
              <p className="text-sm">Try refreshing the page.</p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
