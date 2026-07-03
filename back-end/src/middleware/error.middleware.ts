/**
 * middleware/error.middleware.ts
 *
 * Global Express error handler — converts thrown errors to a typed JSON
 * response with an HTTP status code.
 */

import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message = err?.message ?? 'Internal server error';
  logger.error('http', `${status} ${message}`);
  res.status(status).json({ success: false, error: message });
};
