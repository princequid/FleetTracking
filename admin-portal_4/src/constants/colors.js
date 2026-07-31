/**
 * Avatar shades.
 *
 * These are fills that carry white initials (`.driver-avatar` sets
 * `color: var(--color-on-brand)`), and they do NOT change with the theme — so
 * every entry has to clear 4.5:1 against white on its own.
 *
 * The previous palette did not: #06B6D4 measured 2.42:1, #0E9F9F 3.24:1 and
 * #3B82F6 3.68:1, which axe reported as serious contrast violations on the
 * drivers and staff tables the moment they had rows in them. Cyan and mid-blue
 * simply cannot hold white text at 12px.
 *
 * Replacements keep six clearly distinguishable hues — navy, teal, deep cyan,
 * violet, rust, green — so an avatar still reads as an identity cue, but the
 * lowest ratio in the set is now 5.37:1.
 */
export const AVATAR_SHADES = [
  "#1B3A6B", // navy      11.27:1
  "#0F766E", // teal       5.47:1
  "#155E75", // deep cyan  7.27:1
  "#6D28D9", // violet     7.10:1
  "#9A3412", // rust       7.31:1
  "#0A7A50", // green      5.37:1
];

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

/**
 * Same palette, keyed by a numeric id rather than a name — for the places that
 * only have a driver id to colour by.
 *
 * The dashboard leaderboard used to keep its own parallel palette built from
 * `var(--teal-500)`, `var(--gold-600)` and friends. Those are *semantic* tokens
 * that dark mode remaps, so the fill under the white initials brightened to
 * mint (#2dd4bf) and the label landed at 1.86:1. An avatar fill must be a fixed
 * value, because the text on it is fixed.
 */
export function getAvatarColorById(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return AVATAR_SHADES[0];
  return AVATAR_SHADES[Math.abs(Math.trunc(n)) % AVATAR_SHADES.length];
}
