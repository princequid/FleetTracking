import React from "react";

export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="trips-empty-state">
      {Icon && <Icon size={64} className="trips-empty-icon" />}
      <h2 className="trips-empty-title">{title}</h2>
      {subtitle && <p className="trips-empty-subtitle">{subtitle}</p>}
      {action && (
        <button className="trips-empty-cta" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
