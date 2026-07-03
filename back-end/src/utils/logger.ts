/**
 * utils/logger.ts
 *
 * Tiny structured logger so we don't pull in a dependency for what `console`
 * already does. `LOG_LEVEL=debug` reveals simulator details.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
const threshold = LEVELS[envLevel] ?? LEVELS.info;

const fmt = (level: Level, scope: string, msg: string, extra?: unknown): string => {
  const stamp = new Date().toISOString();
  const base = `[${stamp}] ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  if (extra === undefined) return base;
  try {
    return `${base} ${JSON.stringify(extra)}`;
  } catch {
    return `${base} <unserialisable>`;
  }
};

const should = (level: Level): boolean => (LEVELS[level] ?? LEVELS.info) >= threshold;

export const logger = {
  debug: (scope: string, msg: string, extra?: unknown): void => {
    if (should('debug')) console.log(fmt('debug', scope, msg, extra));
  },
  info: (scope: string, msg: string, extra?: unknown): void => {
    if (should('info')) console.log(fmt('info', scope, msg, extra));
  },
  warn: (scope: string, msg: string, extra?: unknown): void => {
    if (should('warn')) console.warn(fmt('warn', scope, msg, extra));
  },
  error: (scope: string, msg: string, extra?: unknown): void => {
    if (should('error')) console.error(fmt('error', scope, msg, extra));
  },
};
