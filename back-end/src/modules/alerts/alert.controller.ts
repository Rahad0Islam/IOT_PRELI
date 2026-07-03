/**
 * modules/alerts/alert.controller.ts
 */

import type { Request, Response } from 'express';
import { alertService } from './alert.service.js';

export const alertController = {
  /** GET /api/alerts */
  async list(_req: Request, res: Response): Promise<void> {
    const alerts = await alertService.list();
    res.json({ success: true, data: alerts });
  },

  /** DELETE /api/alerts — convenience for the dashboard "clear" button. */
  async clear(_req: Request, res: Response): Promise<void> {
    await alertService.clear();
    res.json({ success: true });
  },
};