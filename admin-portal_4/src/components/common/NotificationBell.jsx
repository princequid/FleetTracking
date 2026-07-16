import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import {
  getDerivedNotifications,
  getLastSeenTs,
  markSeen,
} from "../../services/notificationService";
import { BellIcon } from "./Icons";

// Poll the derived feed (incidents + recent trip events) so the bell stays live
// without a manual refresh. 20s keeps it responsive without hammering the backend.
const POLL_MS = 20000;

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function notificationTone(notification) {
  const severity = normalize(notification?.severity);
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "info";
}

export default function NotificationBell() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => getLastSeenTs(userId));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  const isUnread = useCallback((n) => (n?.createdTs || 0) > lastSeen, [lastSeen]);

  const unreadCount = useMemo(
    () => notifications.filter(isUnread).length,
    [notifications, isUnread]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "Unread") return isUnread(notification);
      if (filter === "Critical") return notificationTone(notification) === "critical";
      return true;
    });
  }, [notifications, filter, isUnread]);

  // Reset the "last seen" baseline when the signed-in admin changes.
  useEffect(() => {
    setLastSeen(getLastSeenTs(userId));
  }, [userId]);

  // Poll the feed on mount and every POLL_MS; also refetches when auth changes.
  useEffect(() => {
    let alive = true;
    let firstLoad = true;

    const load = () =>
      getDerivedNotifications()
        .then((items) => {
          if (alive) setNotifications(items);
        })
        .catch(() => {})
        .finally(() => {
          if (alive && firstLoad) {
            firstLoad = false;
            setLoading(false);
          }
        });

    // Delay the first fetch slightly so it doesn't compete with the initial page
    // load's own requests on the (resource-tight) backend.
    const initialTimer = setTimeout(load, 1500);
    const interval = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [userId]);

  const markAllSeen = useCallback(() => {
    const now = Date.now();
    markSeen(userId, now);
    setLastSeen(now);
  }, [userId]);

  const closePanel = useCallback(() => {
    setOpen(false);
    markAllSeen();
  }, [markAllSeen]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!open) return;
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      closePanel();
    }
    function handleEscape(event) {
      if (event.key === "Escape" && open) closePanel();
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, closePanel]);

  useEffect(() => {
    if (open && location.pathname === "/login") setOpen(false);
  }, [location.pathname, open]);

  function handleNotificationClick(notification) {
    setOpen(false);
    markAllSeen();
    if (notification?.route) navigate(notification.route);
  }

  return (
    <div className="notification-bell-wrap">
      <button
        ref={buttonRef}
        className="navbar-icon-btn"
        type="button"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePanel() : setOpen(true))}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && <span className="notification-dot" />}
      </button>

      {open && (
        <div ref={panelRef} className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <div>
              <div className="notification-panel-title">Notifications</div>
              <div className="notification-panel-subtitle">
                {unreadCount > 0
                  ? `${unreadCount} new alert${unreadCount === 1 ? "" : "s"}`
                  : "All caught up"}
              </div>
            </div>
            <button
              className="notification-mark-all"
              type="button"
              onClick={markAllSeen}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          <div className="notification-filter-chips">
            {["All", "Unread", "Critical"].map((chip) => (
              <button
                key={chip}
                type="button"
                className={`notification-filter-chip${filter === chip ? " notification-filter-chip-active" : ""}`}
                onClick={() => setFilter(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">Loading notifications…</div>
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => {
                const tone = notificationTone(notification);
                const unread = isUnread(notification);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={`notification-row notification-row-${tone}${unread ? " notification-row-unread" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className={`notification-icon notification-icon-${tone}`}>
                      <BellIcon size={14} />
                    </span>
                    <span className="notification-copy">
                      <span className="notification-title">{notification.title}</span>
                      <span className="notification-description">{notification.description}</span>
                    </span>
                    <span className="notification-time">{timeAgo(notification.createdAt)}</span>
                  </button>
                );
              })
            ) : (
              <div className="notification-empty">No notifications match the selected filter.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
