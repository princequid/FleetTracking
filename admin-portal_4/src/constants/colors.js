export const AVATAR_SHADES = ["#1B3A6B", "#2E5090", "#06B6D4", "#0E9F9F", "#3B82F6", "#155E75"];

export function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name) {
  if (!name) return AVATAR_SHADES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_SHADES[Math.abs(hash) % AVATAR_SHADES.length];
}
