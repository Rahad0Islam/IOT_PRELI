/**
 * modules/office/office.service.ts
 */

import { databaseService } from '../../database/database.service.js';
import { runtimeService } from '../runtime/runtime.service.js';
import type { OfficeInfoResponse } from './office.types.js';

export const officeService = {
  async info(): Promise<OfficeInfoResponse> {
    const cfg = await databaseService.getOfficeConfig();
    const snapshot = await runtimeService.snapshot();
    return {
      name: 'Pixel Office',
      officeHours: cfg.officeHours,
      estimatedTodayUsage: snapshot.total.todayKWh,
    };
  },

  async setOfficeHours(start: string, end: string): Promise<OfficeInfoResponse> {
    await databaseService.updateOfficeConfig({ officeHours: { start, end } });
    return this.info();
  },
};