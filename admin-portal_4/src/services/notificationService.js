import api from "./api";

export async function getUnreadCount(userId) {
  if (!userId) return 0;
  try {
    const { data } = await api.get(`/notifications/users/${userId}/unread`);
    if (typeof data === "number") return data;
    if (Array.isArray(data)) return data.length;
    if (data && typeof data.count === "number") return data.count;
    return 0;
  } catch {
    return 0;
  }
}

export async function getNotifications(userId) {
  if (!userId) return [];
  try {
    const { data } = await api.get(`/notifications/users/${userId}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.notifications)) return data.notifications;
    return [];
  } catch {
    return [];
  }
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return null;
  const { data } = await api.put(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllNotificationsRead(userId, notifications = []) {
  if (!userId || !Array.isArray(notifications) || notifications.length === 0) return [];
  const unreadIds = notifications.filter((notification) => !isNotificationRead(notification)).map((notification) => notification.id).filter(Boolean);
  return Promise.allSettled(unreadIds.map((notificationId) => markNotificationRead(notificationId)));
}

export function isNotificationRead(notification) {
  return Boolean(notification?.isRead || notification?.read || notification?.readAt);
}
