import React from "react";

/**
 * The band at the top of every page: title, optional supporting line, optional
 * right-hand actions.
 *
 * Three different shapes had grown for this — `.trips-header` (title + subtitle,
 * no actions), `.page-header-row` (title + actions, no subtitle) and a bare
 * `.trip-detail-header` — so the same heading sat at a different size, weight
 * and vertical rhythm depending on which page you were on. One component means
 * one answer.
 *
 * `meta` is for a status chip or count that belongs to the page rather than to
 * an action (the dashboard's live indicator, the incidents ratio). It sits with
 * the actions but is not a control.
 */
export default function PageHeader({ title, subtitle, actions, meta, className = "" }) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header-text">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {(actions || meta) && (
        <div className="page-header-aside">
          {meta}
          {actions && <div className="page-header-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
