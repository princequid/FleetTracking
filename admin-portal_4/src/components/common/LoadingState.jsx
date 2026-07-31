import React from "react";

/**
 * A page-level "still fetching" block for surfaces that don't yet have a
 * content-shaped skeleton.
 *
 * Replaces the bare `<p className="loading-text">Loading…</p>` that three pages
 * used. Two things that string never did: it was not announced (a sighted user
 * saw it appear, a screen-reader user got silence), and it gave no indication
 * of what was arriving, so a slow response looked identical to a dead one.
 *
 * `role="status"` + `aria-busy` means assistive tech hears the wait; the
 * `aria-live` region also announces the transition when it resolves.
 */
export default function LoadingState({ message = "Loading…" }) {
  return (
    <div className="state-loading" role="status" aria-live="polite" aria-busy="true">
      <span className="state-loading-spinner" aria-hidden="true" />
      <span className="state-loading-text">{message}</span>
    </div>
  );
}
