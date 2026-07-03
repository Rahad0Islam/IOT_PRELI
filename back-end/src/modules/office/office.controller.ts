/**
 * modules/office/office.controller.ts
 */

import type { Request, Response } from 'express';
import { hhmmToMinutes } from '../../utils/time.js';
import { officeService } from './office.service.js';

export const officeController = {
  /** GET /api/office */
  async info(_req: Request, res: Response): Promise<void> {
    const info = await officeService.info();
    res.json({ success: true, data: info });
  },

  /** PUT /api/office/hours */
  async setHours(req: Request, res: Response): Promise<void> {
    const start = String(req.body?.start ?? '');
    const end = String(req.body?.end ?? '');
    if (hhmmToMinutes(start) < 0 || hhmmToMinutes(end) < 0) {
      res.status(400).json({ success: false, error: 'start/end must be HH:MM' });
      return;
    }
    const info = await officeService.setOfficeHours(start, end);
    res.json({ success: true, data: info });
  },
};