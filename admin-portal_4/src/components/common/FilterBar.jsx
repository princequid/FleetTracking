import React from "react";
import { XIcon } from "./Icons";

/**
 * The toolbar that sits directly above a table: search, filters, actions, and a
 * summary of what is currently applied.
 *
 * Before this, filter tabs, the search field and the table were three
 * unconnected bands floating on the page background, with a full-width search
 * input stretched to 1100px on a desktop viewport. Grouping them onto one
 * surface attached to the table says "these control the thing below".
 *
 * `activeFilters` is what makes filtering recoverable: an admin who narrows a
 * list, navigates away and comes back needs to see *why* the list is short.
 * Each chip removes exactly one condition; "Clear all" removes them together.
 */
export default function FilterBar({
  search,
  filters,
  actions,
  activeFilters = [],
  onClearAll,
  resultCount,
  totalCount,
}) {
  const hasActive = activeFilters.length > 0;

  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        {search && <div className="filter-bar-search">{search}</div>}
        {filters && <div className="filter-bar-controls">{filters}</div>}
        {actions && <div className="filter-bar-actions">{actions}</div>}
      </div>

      {(hasActive || resultCount != null) && (
        <div className="filter-bar-summary">
          {resultCount != null && (
            /* Polite, not assertive: the count changes on every keystroke of a
               debounced search, and an assertive region would interrupt the
               user mid-word on every one of them. */
            <span className="filter-bar-count" role="status" aria-live="polite">
              <strong>{resultCount}</strong>
              {totalCount != null && totalCount !== resultCount ? ` of ${totalCount}` : ""} result
              {resultCount === 1 ? "" : "s"}
            </span>
          )}

          {hasActive && (
            <div className="filter-bar-chips">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className="filter-chip-active"
                  onClick={filter.onRemove}
                  aria-label={`Remove filter: ${filter.label} ${filter.value}`}
                >
                  <span className="filter-chip-label">{filter.label}</span>
                  <span className="filter-chip-value">{filter.value}</span>
                  <XIcon size={12} />
                </button>
              ))}
              {onClearAll && (
                <button type="button" className="filter-bar-clear" onClick={onClearAll}>
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
