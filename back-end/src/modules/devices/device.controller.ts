/**
 * modules/devices/device.controller.ts
 */

import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';

import { deviceService } from './device.service.js';
import { usageController } from '../usage/usage.controller.js';
import { logger } from '../../utils/logger.js';

export const deviceController = {
  /** GET /api/devices */
  async list(_req: Request, res: Response): Promise<void> {
    const devices = await deviceService.list();
    res.json({ success: true, data: devices });
  },

  /** GET /api/device/:id */
  async getOne(req: Request, res: Response): Promise<void> {
    const id = String(req.params.id ?? '');
    const device = await deviceService.getById(id);
    if (!device) {
      res.status(404).json({ success: false, error: `Device "${id}" not found` });
      return;
    }
    res.json({ success: true, data: device });
  },

  /** POST /api/device/toggle */
  async toggle(req: Request, res: Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }
    try {
      const updated = await deviceService.toggle(req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Device not found' });
        return;
      }
      res.json({ success: true, data: updated });
      // Touch usage cache (no-op because the controller doesn't cache, but keeps intent explicit).
      void usageController;
    } catch (err) {
      logger.error('devices', 'toggle failed', err);
      res.status(500).json({ success: false, error: 'Internal error' });
    }
  },

  /** GET /api/rooms */
  async rooms(_req: Request, res: Response): Promise<void> {
    const grouped = await deviceService.groupedByRoom();
    res.json({ success: true, data: grouped });
  },

  /** GET /api/rooms/:room */
  async room(req: Request, res: Response): Promise<void> {
    const room = String(req.params.room ?? '');
    const devices = await deviceService.forRoom(room);
    if (devices.length === 0) {
      res.status(404).json({ success: false, error: `Room "${room}" not found` });
      return;
    }
    res.json({ success: true, data: { room, devices } });
  },
};
