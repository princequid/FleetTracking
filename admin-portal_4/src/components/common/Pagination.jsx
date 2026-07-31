import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

/**
 * Table pagination.
 *
 * Only Trips had any — bespoke "Previous / Page 1 of 3 / Next" text buttons —
 * so every other table rendered its entire result set. That is fine at six
 * drivers and not fine at six hundred.
 *
 * Announces the range rather than just the page number ("1–10 of 24"), because
 * "Page 1 of 3" doesn't tell an operator how much data they are actually
 * looking at. The live region is polite so paging doesn't cut across a screen
 * reader mid-sentence.
 */
export default function Pagination({ page, pageSize, total, onPageChange, label = "results" }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-range" role="status" aria-live="polite">
        <strong>
          {first}–{last}
        </strong>{" "}
        of {total} {label}
      </p>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon size={15} />
          <span>Previous</span>
        </button>
        <span className="pagination-page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Next</span>
          <ChevronRightIcon size={15} />
        </button>
      </div>
    </nav>
  );
}
