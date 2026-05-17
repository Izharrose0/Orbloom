import { Component, ReactNode } from 'react';

type State = { error: Error | null };

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[orbloom] runtime error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <div className="error-eyebrow">Cosmic anomaly</div>
            <div className="error-title">The planet encountered an irregularity</div>
            <pre className="error-detail">{String(this.state.error.message ?? this.state.error)}</pre>
            <button className="error-reload" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
