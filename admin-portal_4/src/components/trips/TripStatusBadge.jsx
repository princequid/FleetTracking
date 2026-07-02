import React from "react";
import { getStatusStyle } from "../../constants/tripStatus";

export default function TripStatusBadge({ status }) {
  const style = getStatusStyle(status);
  return (
    <span className="status-badge" style={{ background: style.background, color: style.color }}>
      {status}
    </span>
  );
}
