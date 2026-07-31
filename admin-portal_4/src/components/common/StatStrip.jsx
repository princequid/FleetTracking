import React from "react";

/**
 * Secondary metrics, deliberately subordinate to the KPI row above.
 *
 * The dashboard used to be seven `KpiCard`s in two grid rows — four then three
 * — which meant the *secondary* metrics rendered in wider cards than the
 * primary ones and read as the more important half of the page. Level 1 and
 * level 2 of the hierarchy were inverted by the grid maths alone.
 *
 * This is the level-2 treatment: one horizontal band, small values, dividers
 * instead of card chrome. Still scannable, visibly not the headline.
 *
 * Items may be interactive; when they are they become real buttons rather than
 * click-handling divs.
 */
export default function StatStrip({ items, label }) {
  return (
    <div className="stat-strip" role="group" aria-label={label}>
      {items.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            {Icon && (
              <span className="stat-strip-icon" style={{ color: item.accent }}>
                <Icon size={17} />
              </span>
            )}
            <span className="stat-strip-body">
              <span className="stat-strip-label">{item.label}</span>
              <span className="stat-strip-value">
                {item.value}
                {item.sub && <span className="stat-strip-sub">{item.sub}</span>}
              </span>
            </span>
          </>
        );

        return item.onClick ? (
          <button key={item.label} type="button" className="stat-strip-item" onClick={item.onClick}>
            {content}
          </button>
        ) : (
          <div key={item.label} className="stat-strip-item">
            {content}
          </div>
        );
      })}
    </div>
  );
}
