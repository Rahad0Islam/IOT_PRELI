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

export const config = {
  env: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  port: num('PORT', 4000),

  paths: {
    /** Default LowDB file lives in `src/database/db.json`. */
    dbFile: resolveFromRoot(str('LOWDB_FILE') || path.join('src', 'database', 'db.json')),
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
    continuousRuntimeMs: num('ALERT_RUNTIME_MS', 2 * 60 * 60 * 1000),
  },

  office: {
    start: '09:00',
    end: '17:00',
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