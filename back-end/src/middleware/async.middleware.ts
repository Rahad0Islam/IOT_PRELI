/**
 * middleware/async.middleware.ts
 *
 * Wraps an async route handler so thrown rejections hit the global error
 * middleware instead of crashing the process.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
