import type { TFunction } from "i18next";

/**
 * Numbers, dates and money, Kenyan conventions (PLAN.md §4.9): "1,284",
 * "31 Dec 2026", "KES 1,000". Screens never format by hand, so switching locale
 * later changes one file.
 */
const LOCALE = "en-KE";

const number = new Intl.NumberFormat(LOCALE);
const date = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

export function formatNumber(value: number): string {
  return number.format(value);
}

/** "31 Dec 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? date.format(d) : "";
}

/** "31 Dec, 14:05" — when a lead arrived. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${dayMonth.format(d)}, ${time.format(d)}` : "";
}

/** "31 Dec" — a day on a chart axis. Dates from the database are plain YYYY-MM-DD. */
export function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? dayMonth.format(d) : isoDate;
}

/**
 * "4 min ago", "3 hours ago", "2 days ago", then the date — for lists, where
 * the exact time matters less than how fresh something is.
 */
export function formatAgo(t: TFunction, iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return t("time.justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t("time.daysAgo", { count: days });
  return formatDate(iso);
}

/** "18%" — a change or a share, already a percentage. */
export function formatPercent(value: number): string {
  return `${Math.round(Math.abs(value))}%`;
}
