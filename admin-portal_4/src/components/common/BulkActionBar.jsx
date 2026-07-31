import React from "react";
import Button from "./Button";
import { XIcon } from "./Icons";

/**
 * The bar that appears once rows are selected.
 *
 * Anchored to the bottom of the viewport rather than pushed into the page flow,
 * so selecting a row never reflows the table underneath the cursor that is
 * still selecting rows.
 *
 * `progress` drives the in-flight state: the actions disable, and the bar
 * reports how far through the batch it is. That matters here because these are
 * per-record operations under the hood (see `runBulk`) — a batch of thirty is
 * thirty requests, and going silent for that long reads as a hang.
 */
export default function BulkActionBar({ count, onClear, actions = [], progress }) {
  if (count === 0) return null;

  const busy = Boolean(progress);

  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <div className="bulk-bar-inner">
        <span className="bulk-bar-count">
          <strong>{count}</strong> selected
        </span>

        <span className="bulk-bar-divider" aria-hidden="true" />

        {busy ? (
          <span className="bulk-bar-progress" role="status" aria-live="polite">
            <span className="bulk-bar-progress-track">
              <span
                className="bulk-bar-progress-fill"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </span>
            <span className="bulk-bar-progress-text">
              {progress.label} {progress.done} of {progress.total}
            </span>
          </span>
        ) : (
          <div className="bulk-bar-actions">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant || "secondary"}
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.disabledReason}
              >
                {action.icon && <action.icon size={15} />}
                <span>{action.label}</span>
              </Button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="bulk-bar-clear"
          onClick={onClear}
          disabled={busy}
          aria-label="Clear selection"
        >
          <XIcon size={15} />
        </button>
      </div>
    </div>
  );
}
