/**
 * middleware/logger.middleware.ts
 *
 * Tiny request-logging middleware.
 */

import type { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Avoid flooding logs with socket polling — only count real HTTP.
    if (req.path.startsWith('/socket.io')) return;
    process.stdout.write(`${new Date().toISOString()} ${req.method} ${req.path} → ${res.statusCode} (${ms}ms)\n`);
  });
  next();
};