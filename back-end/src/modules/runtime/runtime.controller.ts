/**
 * modules/runtime/runtime.controller.ts
 *
 * Thin HTTP layer for runtime inspection. The dashboard already receives
 * live updates via the `usage_updated` socket event (driven by the runtime
 * service under the hood); this endpoint is a manual introspection path
 * for debugging and for clients that haven't subscribed to sockets.
 *
 * Two endpoints:
 *   GET /api/runtime            -> compact snapshot (current totals only)
 *   GET /api/runtime/history    -> full per-device daily + monthly history
 */

import type { Request, Response } from 'express';

import { runtimeService } from './runtime.service.js';
import { runtimeHistoryService } from './runtime-history.service.js';

export const runtimeController = {
  /** GET /api/runtime — compact snapshot for the dashboard. */
  async snapshot(_req: Request, res: Response): Promise<void> {
    const snap = await runtimeService.snapshot();
    res.json({ success: true, data: snap });
  },

  /** GET /api/runtime/history — full records including the daily map. */
  async history(_req: Request, res: Response): Promise<void> {
    const records = await runtimeHistoryService.getAll();
    const lastDaily = await runtimeHistoryService.getLastDailyReset();
    res.json({
      success: true,
      data: {
        devices: records,
        lastDailyReset: lastDaily,
        filePath: runtimeHistoryService.path(),
      },
    });
  },
};