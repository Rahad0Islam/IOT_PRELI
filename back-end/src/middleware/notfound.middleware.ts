/**
 * middleware/notfound.middleware.ts
 *
 * 404 handler for unknown routes.
 */

import type { Request, Response } from 'express';

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
};
