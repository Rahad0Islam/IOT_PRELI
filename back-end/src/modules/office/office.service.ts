/**
 * modules/office/office.service.ts
 */

import { databaseService } from '../../database/database.service.js';
import { estimateTodayKWh } from '../usage/usage.service.js';
import type { OfficeInfoResponse } from './office.types.js';

export const officeService = {
  async info(): Promise<OfficeInfoResponse> {
    const cfg = await databaseService.getOfficeConfig();
    const devices = await databaseService.getDevices();
    return {
      name: 'Pixel Office',
      officeHours: cfg.officeHours,
      estimatedTodayUsage: estimateTodayKWh(devices),
    };
  },

  async setOfficeHours(start: string, end: string): Promise<OfficeInfoResponse> {
    await databaseService.updateOfficeConfig({ officeHours: { start, end } });
    return this.info();
  },
};