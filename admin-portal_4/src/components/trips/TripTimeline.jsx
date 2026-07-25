import React from "react";

function resolveActorLabel(changedBy, driver) {
  if (changedBy == null) return "System";
  if (driver?.userId === changedBy) return driver.fullName;
  return `Staff #${changedBy}`;
}

export default function TripTimeline({ history, driver }) {
  if (!history || history.length === 0) {
    return <p className="trip-timeline-empty">No status history available.</p>;
  }

  return (
    <div className="trip-timeline">
      {history.map((entry, index) => {
        const isActive = index === history.length - 1;
        const dotClass = isActive
          ? "trip-timeline-dot trip-timeline-dot-active"
          : "trip-timeline-dot trip-timeline-dot-past";

        return (
          <div className="trip-timeline-item" key={`${entry.newStatus}-${entry.changedAt}`}>
            <div className="trip-timeline-marker">
              <span className={dotClass} />
              {index < history.length - 1 && (
                <span className="trip-timeline-line trip-timeline-line-solid" />
              )}
            </div>
            <div className="trip-timeline-content">
              <div className="trip-timeline-label">
                {entry.oldStatus ? `${entry.oldStatus} → ${entry.newStatus}` : entry.newStatus}
              </div>
              <div className="trip-timeline-actor">{resolveActorLabel(entry.changedBy, driver)}</div>
              <div className="trip-timeline-time">
                {entry.changedAt ? new Date(entry.changedAt).toLocaleString() : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
