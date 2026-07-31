import React from "react";

/**
 * The card surface every data table sits on.
 *
 * Exists to own one accessibility contract in a single place: below 768px
 * `index.css` gives `.trips-table-card` `overflow-x: auto`, which makes it a
 * scroll container. A scroll container that can't take focus cannot be scrolled
 * by keyboard alone, so the columns past the fold become unreachable —
 * WCAG 2.1.1, and what axe reports as `scrollable-region-focusable`.
 *
 * `tabIndex={0}` fixes that, and the `region`/`aria-label` pair is what gives the
 * resulting tab stop a name — a bare `aria-label` on a plain `div` is ignored,
 * since a generic element exposes no name.
 *
 * Six pages rendered this wrapper by hand before; they now share this.
 */
export default function TableCard({ label, children, className = "" }) {
  return (
    <div
      className={className ? `trips-table-card ${className}` : "trips-table-card"}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}
