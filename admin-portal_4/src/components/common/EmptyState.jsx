import React from "react";
import Button from "./Button";

/**
 * "There is nothing here, and that is not an error."
 *
 * Distinct from `ErrorState`, which means "we could not find out". Keeping the
 * two apart is the difference between an ops console saying "no open incidents"
 * and saying "we cannot reach the incident log" — see ErrorState for why that
 * distinction is load-bearing in this product.
 *
 * Prefer `illustration` over `icon`. A 64px Lucide outline glyph blown up to
 * fill an empty table reads as a UI control that lost its button, not as
 * artwork; the illustrations in `Icons.jsx` are drawn at this size and share one
 * visual language across the portal.
 *
 * `variant="filtered"` is for "your filters matched nothing", which needs a
 * different remedy (loosen the filter) than "this list is genuinely empty"
 * (create the first record) — so the two must not render identical copy.
 *
 * The title is a `<p>`, not an `<h2>`: these appear inside a table cell on a
 * page that already has an `<h1>`, and injecting a heading there produced a
 * document outline where "No drivers registered" ranked alongside the page's
 * real sections.
 */
export default function EmptyState({
  illustration: Illustration,
  icon: Icon,
  title,
  subtitle,
  action,
  secondaryAction,
  variant = "empty",
  compact = false,
}) {
  return (
    <div className={`empty-state${compact ? " empty-state-compact" : ""}`} data-variant={variant}>
      {Illustration ? (
        <Illustration className="empty-state-art" />
      ) : Icon ? (
        <Icon size={44} className="empty-state-icon" />
      ) : null}

      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}

      {(action || secondaryAction) && (
        <div className="empty-state-actions">
          {action && (
            <Button variant="primary" size="sm" onClick={action.onClick}>
              {action.icon && <action.icon size={15} />}
              <span>{action.label}</span>
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
