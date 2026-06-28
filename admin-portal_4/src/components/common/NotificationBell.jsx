import React from "react";

export default function NotificationBell() {
  return (
    <button className="notification-bell" type="button" aria-label="Notifications">
      <span className="notification-bell-dot" />
      🔔
    </button>
  );
}

