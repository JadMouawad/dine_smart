import { Component } from "react";

/**
 * ErrorBoundary — catches render errors and shows a fallback UI
 * instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom message</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="errorBoundary" role="alert">
          <h2 className="errorBoundary__title">Something went wrong</h2>
          <p className="errorBoundary__message">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="btn btn--gold"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
