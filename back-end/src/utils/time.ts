/**
 * utils/time.ts
 *
 * Pure time helpers. No `Date.now()` calls inside business logic should
 * rely on local timezone behaviour; everything routes through here.
 */

/** Return now as an ISO 8601 string. */
export const nowISO = (): string => new Date().toISOString();

/** Return ms since `iso`. Returns negative if `iso` is in the future. */
export const msSince = (iso: string): number => Date.now() - new Date(iso).getTime();

/**
 * Parse "HH:MM" into minutes-since-midnight using local time.
 * Returns -1 if the string is malformed.
 */
export const hhmmToMinutes = (hhmm: string): number => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return -1;
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
};

/** Minutes-since-midnight for the given Date (defaults to now). */
export const currentMinutesOfDay = (at: Date = new Date()): number =>
  at.getHours() * 60 + at.getMinutes();

/**
 * True if `now`'s HH:MM is strictly between `start` and `end`.
 * - `start` is inclusive, `end` is exclusive (so a 17:00 end means
 *   the office is closed AT 17:00 — that minute counts as after-hours).
 * - If the input is malformed or `start >= end`, returns `false`
 *   (treat as "after hours" so devices alert rather than get silently
 *    masked by broken config).
 */
export const isWithinOfficeHours = (
  start: string,
  end: string,
  now: Date = new Date()
): boolean => {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  if (s < 0 || e < 0) return false;
  // Allow cross-midnight (e.g. 22:00 → 06:00) by detecting s > e.
  const cur = currentMinutesOfDay(now);
  if (s < e) {
    // Same-day window:  s <= cur < e
    return cur >= s && cur < e;
  }
  // Cross-midnight: cur >= s OR cur < e
  return cur >= s || cur < e;
};

/** Format milliseconds as `"1h 23m"` for human consumption. */
export const msToHumanDuration = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
