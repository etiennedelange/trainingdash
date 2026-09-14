import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level crash guard: React only unmounts the tree on an uncaught render
 * error, otherwise the athlete is staring at a blank page. This is the last
 * line of defense, not a substitute for the route-level DataError states.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Uncaught render error", error, info.componentStack);
  }

  retry = () => {
    // Try a plain re-render first — most crashes come from a bad response
    // shape that a fresh fetch fixes, so a full reload isn't always needed.
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ground p-10 text-center">
          <h1 className="font-display text-xl font-bold text-text">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted">
            Trainingdash hit an unexpected error. Retrying usually fixes it.
          </p>
          <button type="button" onClick={this.retry} className="rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-bold text-on-accent">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
