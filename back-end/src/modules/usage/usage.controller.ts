/**
 * modules/usage/usage.controller.ts
 *
 * Thin HTTP layer. Reads devices from the database, hands them to the
 * service, and returns the snapshot. Caches nothing — every request is a
 * real snapshot of the current state.
 */

import type { Request, Response } from 'express';

import { databaseService } from '../../database/database.service.js';
import { runtimeService } from '../runtime/runtime.service.js';
import { buildOfficeUsage } from './usage.service.js';

export const usageController = {
  /** GET /api/usage */
  async snapshot(_req: Request, res: Response): Promise<void> {
    const devices = await databaseService.getDevices();
    const runtime = await runtimeService.snapshot();
    res.json({ success: true, data: buildOfficeUsage(devices, runtime) });
  },
};
