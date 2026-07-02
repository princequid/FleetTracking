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
