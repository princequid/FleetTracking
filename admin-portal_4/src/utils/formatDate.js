/**
 * Date and time formatting for dense operational tables.
 *
 * `new Date(x).toLocaleString()` produced "7/30/2026, 5:09:52 AM" in the ETA
 * column — 22 characters, seconds precision nobody reads, and the widest column
 * in the table spent on the least scannable value. These formatters trade
 * absolute precision for the thing an operator is actually asking: is this
 * soon, and was that recent?
 *
 * The full timestamp is still available as a `title` on the cell, so precision
 * is one hover away rather than gone.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "5:09 AM" */
export function formatTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "30 Jul" — or "30 Jul 2025" once the year differs from today's. */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Table timestamp: drops the date entirely for today, because in an operations
 * list most rows *are* today and repeating the date on all of them is noise.
 * "5:09 AM" · "Yesterday 5:09 AM" · "28 Jul, 5:09 AM"
 */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  const now = new Date();

  if (isSameDay(date, now)) return formatTime(date);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday ${formatTime(date)}`;

  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** "just now" · "12m ago" · "3h ago" · "5d ago" */
export function timeAgo(value) {
  const date = toDate(value);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

/**
 * Forward-looking counterpart for an ETA: "in 25m", "in 2h 10m", "overdue by 8m".
 * Returns null for a missing value so a caller can pick its own placeholder.
 */
export function timeUntil(value) {
  const date = toDate(value);
  if (!date) return null;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);

  const hours = Math.floor(abs / HOUR);
  const minutes = Math.round((abs % HOUR) / MINUTE);
  const span = hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;

  if (diff < 0) return { overdue: true, label: `overdue by ${span}` };
  return { overdue: false, label: `in ${span}` };
}

/** The unabbreviated value, for a `title` attribute. */
export function formatFull(value) {
  const date = toDate(value);
  return date ? date.toLocaleString() : "";
}
