/**
 * Date helpers. Everything here works in `YYYY-MM-DD` strings and treats a
 * bare date as noon UTC, which keeps day arithmetic from drifting across
 * timezones — the difference between "10 days since applying" and "9 days,
 * 23 hours" is the difference between a task firing and silently not.
 */

const DAY_MS = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
}

export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysSince(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - toDate(iso).getTime()) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `2026-08` → `Aug 2026`. Empty input yields an empty string. */
export function formatMonth(ym: string): string {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || !months[idx]) return ym;
  return `${months[idx]} ${y}`;
}

/** `2026-08` → months since year 0, for timeline positioning. */
export function monthIndex(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return 0;
  return y * 12 + (m - 1);
}

export function formatDay(iso: string): string {
  return toDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
