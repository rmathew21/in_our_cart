const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "2 hours ago", "3 days ago", then a short date. */
export function formatRelative(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then); // clamp small clock skew between devices

  if (diff < 45_000) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))} min ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return h === 1 ? "1 hour ago" : `${h} hours ago`;
  }
  if (diff < 7 * DAY) {
    const d = Math.floor(diff / DAY);
    return d === 1 ? "1 day ago" : `${d} days ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
