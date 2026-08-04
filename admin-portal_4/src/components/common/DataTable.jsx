import React, { useMemo } from "react";
import TableCard from "./TableCard";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import Pagination from "./Pagination";
import { rowNavProps } from "../../utils/rowNav";
import { ChevronDownIcon } from "./Icons";

/**
 * The one table.
 *
 * Six tables had been written by hand against the same `.trips-data-table`
 * class, and each had drifted: only Reports could sort, only Trips paginated,
 * three showed a "Loading…" string where the others showed skeleton rows, and
 * every one of them put `onClick` on a bare `<tr>` so no row was reachable by
 * keyboard. Rather than fix the same bug six times, they now share this.
 *
 * ## Column shape
 *
 *   {
 *     key,                     // unique; also the default sort key
 *     header,                  // column label
 *     render: (row) => node,   // cell content (defaults to row[key])
 *     align: "start" | "end",  // "end" right-aligns — use it for every number
 *     numeric: true,           // tabular figures + right alignment
 *     width,                   // fixed px, for icon/action columns
 *     sortable: true,
 *     sortValue: (row) => any, // what to compare when sorting
 *     hideBelow: "md",         // drop from the table on small screens
 *     truncate: true,          // clip to one line with an ellipsis (text only)
 *     card: "title",           // role in the mobile card layout — see below
 *   }
 *
 * ## Card roles
 *
 * Below 768px a row is a card, not a strip of cells. Without direction every
 * field renders at the same weight, so a card reads as a column of "LABEL
 * value" pairs where the trip number is no more prominent than the plate. The
 * `card` role says which field is which:
 *
 *   "title"    the record's identity — headline of the card (one per table)
 *   "meta"     the state that qualifies it — status badge, top-right
 *   "wide"     too long for a half-width cell — spans the card (route, address)
 *   "actions"  controls — footer row under a rule, tap-target sized
 *
 * Unflagged columns fill a two-up grid beneath the header. `hideBelow` columns
 * come back here: a card has room a table column didn't.
 *
 * ## Why sorting lives here
 *
 * `aria-sort` has to be on the `<th>` and the control has to be a real
 * `<button>` inside it — a clickable `<th>` is not focusable and announces
 * nothing. Reports got that right; nothing else had sorting at all. Centralising
 * it means the next table gets the accessible version for free.
 */

function defaultSortValue(row, column) {
  const raw = column.sortValue ? column.sortValue(row) : row[column.key];
  return raw ?? "";
}

function compare(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  // Numeric strings ("#1004", "1200") should order numerically, not lexically,
  // or 10 sorts before 9.
  const na = Number(String(a).replace(/[^\d.-]/g, ""));
  const nb = Number(String(b).replace(/[^\d.-]/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a) !== "" && String(b) !== "") {
    return na - nb;
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

function SortButton({ column, sort, onSortChange }) {
  const active = sort?.key === column.key;
  const dir = active ? sort.dir : null;

  return (
    <button
      type="button"
      className={`th-sort${active ? " th-sort-active" : ""}`}
      onClick={() =>
        onSortChange(
          active && sort.dir === "asc"
            ? { key: column.key, dir: "desc" }
            : { key: column.key, dir: "asc" },
        )
      }
    >
      <span>{column.header}</span>
      <ChevronDownIcon
        size={13}
        className={`th-sort-glyph${active ? ` th-sort-glyph-${dir}` : ""}`}
      />
    </button>
  );
}

export default function DataTable({
  label,
  columns,
  rows,
  rowKey,
  caption,

  loading = false,
  error = null,
  onRetry,
  empty,

  onRowActivate,
  rowLabel,
  isRowHighlighted,
  renderExpansion,
  expandedKey,

  sort,
  onSortChange,

  page,
  pageSize,
  onPageChange,

  selection,

  density = "comfortable",
  className = "",
}) {
  // Sorting is applied here rather than by each page, so a column marked
  // sortable actually sorts without six copies of the same reducer. A page that
  // sorts server-side simply doesn't pass `sort`.
  const sortedRows = useMemo(() => {
    if (!sort?.key) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const factor = sort.dir === "desc" ? -1 : 1;
    return [...rows].sort(
      (a, b) => factor * compare(defaultSortValue(a, column), defaultSortValue(b, column)),
    );
  }, [rows, sort, columns]);

  // Paging happens *after* sorting, and both happen here. When the caller sliced
  // the array itself and handed over one page, "sort" only reordered the twelve
  // rows already on screen — which looks like sorting right up until you notice
  // page 2 still holds the rows that should have moved to page 1.
  const paginated = page != null && pageSize != null;
  const visibleRows = useMemo(
    () => (paginated ? sortedRows.slice((page - 1) * pageSize, page * pageSize) : sortedRows),
    [sortedRows, paginated, page, pageSize],
  );

  /**
   * Selection.
   *
   * `selectableRows` is what the header checkbox operates on, and it is scoped
   * to the *visible page* — never the whole result set. A "select all" that
   * silently reaches across pages is how someone cancels 200 trips intending to
   * cancel 12. `selection.isSelectable` lets a page exclude rows the action
   * cannot apply to (an already-cancelled trip, an inactive driver), so the
   * count in the bulk bar always matches what will actually happen.
   */
  const selectable = Boolean(selection);
  const selectableRows = selectable
    ? visibleRows.filter((row) => selection.isSelectable?.(row) ?? true)
    : [];
  const selectedKeys = selection?.selected ?? new Set();
  const selectedOnPage = selectableRows.filter((row) => selectedKeys.has(rowKey(row)));
  const allOnPageSelected =
    selectableRows.length > 0 && selectedOnPage.length === selectableRows.length;
  const someOnPageSelected = selectedOnPage.length > 0 && !allOnPageSelected;

  function toggleAllOnPage() {
    const next = new Set(selectedKeys);
    if (allOnPageSelected) selectableRows.forEach((row) => next.delete(rowKey(row)));
    else selectableRows.forEach((row) => next.add(rowKey(row)));
    selection.onChange(next);
  }

  function toggleRow(row) {
    const next = new Set(selectedKeys);
    const key = rowKey(row);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    selection.onChange(next);
  }

  const colSpan = columns.length + (selectable ? 1 : 0);

  function body() {
    if (loading) {
      return Array.from({ length: 6 }, (_, r) => (
        <tr key={`skeleton-${r}`} className="skeleton-row" aria-hidden="true">
          {selectable && (
            <td className="select-cell">
              <div className="skeleton-bar" style={{ width: 16, height: 16 }} />
            </td>
          )}
          {columns.map((column) => (
            // The card roles ride along on the skeleton so the placeholder has
            // the shape of the card it's standing in for, not six equal bars.
            <td key={column.key} className={column.card ? `card-cell-${column.card}` : undefined}>
              <div
                className="skeleton-bar"
                /* Vary the width per column so the placeholder reads as a table
                   of content rather than a block of identical grey bars. */
                style={{ width: column.width ? column.width - 16 : `${55 + ((r * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ));
    }

    if (error) {
      return (
        // Tagged so card mode can opt this row out of the card treatment —
        // an empty/error state framed as one more record card reads as a
        // result rather than the absence of results.
        <tr className="data-table-state-row">
          <td colSpan={colSpan} className="data-table-state-cell">
            <ErrorState
              title={error.title}
              message={error.message}
              onRetry={onRetry}
            />
          </td>
        </tr>
      );
    }

    if (visibleRows.length === 0) {
      return (
        <tr className="data-table-state-row">
          <td colSpan={colSpan} className="data-table-state-cell">
            <EmptyState {...empty} />
          </td>
        </tr>
      );
    }

    return visibleRows.map((row) => {
      const key = rowKey(row);
      const interactive = typeof onRowActivate === "function";
      const expanded = renderExpansion && expandedKey === key;

      const isSelected = selectable && selectedKeys.has(key);
      const rowSelectable = selectable && (selection.isSelectable?.(row) ?? true);

      return (
        <React.Fragment key={key}>
          <tr
            className={
              [
                isRowHighlighted?.(row) ? "data-table-row-flagged" : "",
                expanded ? "expanded-row" : "",
                isSelected ? "data-table-row-selected" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            {...(interactive
              ? rowNavProps(() => onRowActivate(row), { label: rowLabel?.(row) })
              : {})}
          >
            {selectable && (
              <td className="select-cell" onClick={(e) => e.stopPropagation()} data-label="Select">
                <input
                  type="checkbox"
                  className="row-checkbox"
                  checked={isSelected}
                  disabled={!rowSelectable}
                  // The row already carries an accessible name via rowNavProps;
                  // the checkbox needs its own, or it announces as an unlabelled
                  // control repeated once per row.
                  aria-label={
                    rowSelectable
                      ? `Select ${selection.rowLabel?.(row) ?? key}`
                      : (selection.notSelectableReason?.(row) ?? "Not selectable")
                  }
                  title={!rowSelectable ? selection.notSelectableReason?.(row) : undefined}
                  onChange={() => toggleRow(row)}
                />
              </td>
            )}
            {columns.map((column) => (
              <td
                key={column.key}
                className={[
                  column.numeric || column.align === "end" ? "cell-end" : "",
                  column.hideBelow ? `hide-below-${column.hideBelow}` : "",
                  // Opt-in: applying ellipsis to every cell also clipped the ones
                  // holding a badge or a pair of buttons, which came out as a
                  // status pill with a stray "…" beside it.
                  column.truncate ? "cell-truncate" : "",
                  // Inert above 768px; below it, this is what gives the card a
                  // headline, a status corner and a footer instead of a list.
                  column.card ? `card-cell-${column.card}` : "",
                  column.cellClassName || "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined}
                // The header text is repeated onto the cell so the mobile card
                // layout can print it as a label via CSS ::before, instead of
                // duplicating every table into a second markup tree.
                data-label={column.header}
                data-numeric={column.numeric ? "" : undefined}
              >
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
          {expanded && (
            <tr className="detail-expansion-row">
              <td colSpan={colSpan}>{renderExpansion(row)}</td>
            </tr>
          )}
        </React.Fragment>
      );
    });
  }

  return (
    <TableCard label={label} className={`data-table-card ${className}`.trim()}>
      <table
        // `data-table-selectable` lets card mode reserve a checkbox column in
        // the card's header row. It can't be derived in CSS: the checkbox is a
        // cell like any other, and a card with no selection must not leave a
        // gap where one would have been.
        className={`trips-data-table data-table density-${density}${
          selectable ? " data-table-selectable" : ""
        }`}
        // `aria-busy` is what tells a screen reader the skeleton rows are a
        // placeholder rather than six real records of blank data.
        aria-busy={loading || undefined}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="select-cell">
                <input
                  type="checkbox"
                  className="row-checkbox"
                  checked={allOnPageSelected}
                  // Indeterminate is a DOM property, not an attribute — React
                  // cannot set it declaratively, so it goes on via the ref.
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected;
                  }}
                  disabled={selectableRows.length === 0}
                  aria-label={
                    allOnPageSelected
                      ? "Deselect all rows on this page"
                      : "Select all rows on this page"
                  }
                  onChange={toggleAllOnPage}
                />
              </th>
            )}
            {columns.map((column) => {
              const sortable = column.sortable && onSortChange;
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width, minWidth: column.width } : undefined}
                  className={[
                    column.numeric || column.align === "end" ? "cell-end" : "",
                    column.hideBelow ? `hide-below-${column.hideBelow}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  aria-sort={
                    !sortable
                      ? undefined
                      : sort?.key === column.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortable ? (
                    <SortButton column={column} sort={sort} onSortChange={onSortChange} />
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{body()}</tbody>
      </table>

      {paginated && !loading && !error && sortedRows.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={sortedRows.length}
          onPageChange={onPageChange}
          label={label.toLowerCase()}
        />
      )}
    </TableCard>
  );
}
