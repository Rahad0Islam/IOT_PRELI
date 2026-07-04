/**
 * config/config.ts
 *
 * Centralised, typed configuration loaded from environment variables.
 * Keeping config in one place is a deliberate SRP decision — every other
 * module imports from here instead of reading `process.env` directly.
 */

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolve a path string. Absolute paths are kept as-is; relative paths resolve from the project root. */
const resolveFromRoot = (relative: string): string => {
  // /src/config/config.ts -> / (project root)
  const projectRoot = path.resolve(__dirname, '..', '..');
  return path.isAbsolute(relative) ? relative : path.join(projectRoot, relative);
};

/** Strict string env var that falls back to `defaultValue` if empty/undefined. */
const str = (key: string, defaultValue = ''): string => {
  const v = process.env[key];
  return v === undefined || v === '' ? defaultValue : v;
};

/** Numeric env var with sane default. */
const num = (key: string, defaultValue: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

/**
 * Format a (validated) integer hour 0..23 as a `HH:00` string.
 * Anything outside that range collapses to the default `9`.
 */
function formatHourToHHMM(hour: number): string {
  const safe = Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 9;
  return `${String(safe).padStart(2, '0')}:00`;
}

export const config = {
  env: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  port: num('PORT', 4000),

  paths: {
    /** Default LowDB file lives in `src/database/db.json`. */
    dbFile: resolveFromRoot(str('LOWDB_FILE') || path.join('src', 'database', 'db.json')),
    /**
     * Runtime history lives in its own file (`src/database/runtime-history.json`)
     * so a corrupt history can't bring down the device list, and so the file
     * can be inspected / rotated independently.
     */
    runtimeHistoryFile: resolveFromRoot(
      str('RUNTIME_HISTORY_FILE') || path.join('src', 'database', 'runtime-history.json')
    ),
    publicDir: resolveFromRoot('public'),
  },

  discord: {
    token: str('DISCORD_TOKEN'),
    alertChannelId: str('DISCORD_ALERT_CHANNEL_ID'),
    guildIds: str('DISCORD_GUILD_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    /** When false the bot will not try to log in. Useful for environments without a token. */
    enabled: str('DISCORD_TOKEN').length > 0,
  },

  gemini: {
    apiKey: str('GEMINI_API_KEY'),
    model: str('GEMINI_MODEL', 'gemini-1.5-flash'),
    enabled: str('GEMINI_API_KEY').length > 0,
  },

  simulator: {
    /** Run interval in ms. Spec says 10–15s. */
    intervalMs: num('SIMULATOR_INTERVAL_MS', 12_000),
    /** How many devices to toggle per tick. Spec says 1–2. */
    minFlipPerTick: 1,
    maxFlipPerTick: 2,
    /** Probability that the device ends up ON (rest OFF). */
    onProbability: 0.5,
    enabled: str('SIMULATOR_ENABLED', 'true').toLowerCase() !== 'false',
  },

  alerts: {
    /** Background scanner interval in ms. */
    scanIntervalMs: num('ALERT_SCAN_INTERVAL_MS', 60_000),
    /** Continuous runtime threshold — devices ON longer than this trigger an alert. */
    continuousRuntimeMs:
      num('DEVICE_RUNTIME_ALERT_MINUTES', 120) * 60 * 1000,
  },

  runtime: {
    /**
     * How often the runtime service persists the in-memory totals to disk
     * while devices are ON. Lower = more accurate dashboard numbers across
     * crashes, higher = less disk I/O. Default 30s matches the SPEC.
     */
    persistIntervalMs: num('RUNTIME_PERSIST_INTERVAL_MS', 30_000),
    /**
     * How often the runtime service wakes up to (a) re-persist running
     * sessions and (b) emit `runtime_updated` so the dashboard can refresh.
     * Default 30s.
     */
    tickIntervalMs: num('RUNTIME_TICK_INTERVAL_MS', 30_000),
  },

  office: {
    /**
     * Office hours come from `OFFICE_START_HOUR` / `OFFICE_END_HOUR`.
     * They are integer hours (0–23), NOT minutes. They are formatted to
     * `HH:00` here so downstream `isWithinOfficeHours` (which expects
     * `HH:MM` strings) can compare apples to apples.
     */
    startHour: num('OFFICE_START_HOUR', 9),
    endHour: num('OFFICE_END_HOUR', 17),
    start: formatHourToHHMM(num('OFFICE_START_HOUR', 9)),
    end: formatHourToHHMM(num('OFFICE_END_HOUR', 17)),
  },

  cors: {
    /** Comma-separated allowed origins. Use `*` for all. */
    origins: str('CORS_ORIGINS', '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
} as const;

export type AppConfig = typeof config;