import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { getUnreadCount } from "../../services/notificationService";
import { BellIcon } from "./Icons";

export default function NotificationBell() {
  const userId = useAuthStore((state) => state.userId);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getUnreadCount(userId).then((count) => {
      if (!cancelled) setUnreadCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <button className="navbar-icon-btn" type="button" aria-label="Notifications">
      <BellIcon size={18} />
      {unreadCount > 0 && <span className="notification-dot" />}
    </button>
  );
}
