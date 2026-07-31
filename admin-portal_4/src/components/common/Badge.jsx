import React from "react";

/**
 * Status chip. `variant` resolves to theme-aware tokens (see .badge-* in
 * index.css) so contrast holds in both light and dark.
 *
 * `dot` adds a leading indicator that inherits the label colour — status is then
 * carried by shape and text as well as hue, so it never depends on colour alone.
 */
export default function Badge({ variant = "default", dot = false, children }) {
  return (
    <span className={`badge badge-${variant}${dot ? " badge-dot" : ""}`}>{children}</span>
  );
}
