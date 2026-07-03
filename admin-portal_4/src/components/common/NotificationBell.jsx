import React, { useEffect, useMemo, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import {
  getNotifications,
  getUnreadCount,
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationService";
import { BellIcon } from "./Icons";

const WS_URL = "http://localhost:8080/ws";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function notificationTone(notification) {
  const severity = normalize(notification?.severity || notification?.priority || notification?.level);
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "success") return "success";
  return "info";
}

function notificationTitle(notification) {
  if (notification?.title) return notification.title;
  const type = normalize(notification?.type || notification?.notificationType);
  if (type.includes("trip") && type.includes("assigned")) return "New trip assigned";
  if (type.includes("trip") && type.includes("started")) return "Driver started a trip";
  if (type.includes("trip") && type.includes("arriv")) return "Vehicle arrived at destination";
  if (type.includes("trip") && type.includes("complete")) return "Trip completed with POD";
  if (type.includes("route") || type.includes("deviat")) return "Trip deviated from route";
  if (type.includes("incident") && notificationTone(notification) === "critical") {
    return "Incident reported - CRITICAL";
  }
  if (type.includes("incident")) return "Incident reported - HIGH";
  if (type.includes("gps") && type.includes("lost")) return "GPS signal lost";
  if (type.includes("overdue")) return "Trip overdue";
  return notification?.subject || notification?.event || "Fleet notification";
}

function notificationDescription(notification) {
  return (
    notification?.description ||
    notification?.message ||
    notification?.details ||
    notification?.body ||
    "No additional details provided."
  );
}

function notificationRoute(notification) {
  const type = normalize(notification?.type || notification?.notificationType);
  const entityType = normalize(notification?.entityType || notification?.targetType);
  const tripId = notification?.tripId || notification?.entityId || notification?.targetId;
  const incidentId = notification?.incidentId || (entityType === "incident" ? tripId : null);

  if (incidentId || type.includes("incident")) {
    return `/incidents${incidentId ? `?incidentId=${incidentId}` : ""}`;
  }

  if (tripId && (type.includes("trip") || entityType === "trip")) {
    return `/trips/${tripId}`;
  }

  if (type.includes("driver") || entityType === "driver") {
    return notification?.driverId ? `/drivers/${notification.driverId}` : "/drivers";
  }

  if (type.includes("vehicle") || entityType === "vehicle") {
    return "/vehicles";
  }

  if (type.includes("map") || type.includes("gps")) {
    return "/map";
  }

  return "/dashboard";
}

function isUnread(notification) {
  return !isNotificationRead(notification);
}

function sortNotifications(items) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt || b.updatedAt || 0).getTime() -
      new Date(a.createdAt || a.updatedAt || 0).getTime()
  );
}

export default function NotificationBell() {
  const userId = useAuthStore((state) => state.userId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const clientRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("All");

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (filter === "Unread") return isUnread(notification);
      if (filter === "Critical") return notificationTone(notification) === "critical";
      return true;
    });
  }, [notifications, filter]);

  useEffect(() => {
    let cancelled = false;
    getUnreadCount(userId).then((count) => {
      if (!cancelled) setUnreadCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !accessToken) return undefined;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/topic/admin/notifications", (message) => {
          try {
            const incoming = JSON.parse(message.body);
            const payload = Array.isArray(incoming) ? incoming : [incoming];
            setNotifications((prev) => {
              const next = [...prev];
              payload.forEach((notification) => {
                if (!notification?.id) return;
                const index = next.findIndex((item) => item.id === notification.id);
                if (index >= 0) next[index] = { ...next[index], ...notification };
                else next.unshift(notification);
              });
              return sortNotifications(next);
            });
            setUnreadCount((count) => count + payload.filter(isUnread).length);
          } catch {
            // ignore malformed payloads
          }
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [accessToken, userId]);

  useEffect(() => {
    if (!open || !userId) return undefined;

    let cancelled = false;
    setLoading(true);
    getNotifications(userId)
      .then((items) => {
        if (cancelled) return;
        const sorted = sortNotifications(items);
        setNotifications(sorted);
        setUnreadCount(sorted.filter(isUnread).length);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!open) return;
      if (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (location.pathname === "/login") setOpen(false);
  }, [location.pathname, open]);

  async function handleNotificationClick(notification) {
    if (notification?.id && isUnread(notification)) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: true, read: true, readAt: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    navigate(notificationRoute(notification));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(userId, notifications);
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        isRead: true,
        read: true,
        readAt: notification.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);
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
        onClick={() => setOpen((value) => !value)}
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
                  ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}`
                  : "All caught up"}
              </div>
            </div>
            <button
              className="notification-mark-all"
              type="button"
              onClick={handleMarkAllRead}
              disabled={!notifications.some(isUnread)}
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
                    key={`${notification.id || "new"}-${notification.createdAt || notification.updatedAt || "0"}`}
                    type="button"
                    className={`notification-row notification-row-${tone}${unread ? " notification-row-unread" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className={`notification-icon notification-icon-${tone}`}>
                      <BellIcon size={14} />
                    </span>
                    <span className="notification-copy">
                      <span className="notification-title">{notificationTitle(notification)}</span>
                      <span className="notification-description">{notificationDescription(notification)}</span>
                    </span>
                    <span className="notification-time">
                      {timeAgo(notification.createdAt || notification.updatedAt)}
                    </span>
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