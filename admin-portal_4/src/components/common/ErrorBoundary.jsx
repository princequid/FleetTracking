import React from "react";

/**
 * Catches render-phase errors so one bad payload can't blank the whole console.
 *
 * Suspense (in Layout) covers chunk *loading*, not chunk-load *failure* — which
 * is common right after a redeploy invalidates hashed filenames — nor errors
 * thrown while rendering. Without this, a null field inside a .map() unmounts
 * the entire tree to a white page with no recovery but a manual reload.
 *
 * Keyed on pathname by the caller so navigating away clears a stuck error.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Left as console until a crash reporter (e.g. Sentry) is wired up; at least
    // the stack survives in the browser log instead of vanishing with the tree.
    console.error("[ui] render error", error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isChunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(
      this.state.error?.message || ""
    );

    return (
      <div className="state-error" role="alert">
        <p className="state-error-title">
          {isChunkError ? "This page failed to load" : "Something went wrong"}
        </p>
        <p className="state-error-msg">
          {isChunkError
            ? "The app was updated while this tab was open. Reloading will pick up the new version."
            : "This screen hit an unexpected error. Reloading usually clears it."}
        </p>
        <button className="btn btn-primary btn-sm" type="button" onClick={this.handleReload}>
          Reload
        </button>
      </div>
    );
  }
}
