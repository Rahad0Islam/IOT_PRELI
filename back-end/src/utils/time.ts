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

/** True if `now`'s HH:MM is strictly between `start` and `end` (inclusive of start, exclusive of end). */
export const isWithinOfficeHours = (start: string, end: string, now: Date = new Date()): boolean => {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  const cur = currentMinutesOfDay(now);
  if (s < 0 || e < 0 || s >= e) return false;
  return cur >= s && cur < e;
};

/** Format milliseconds as `"1h 23m"` for human consumption. */
export const msToHumanDuration = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
