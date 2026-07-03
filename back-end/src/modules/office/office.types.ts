/**
 * modules/office/office.types.ts
 */

import type { OfficeHours } from '../../interfaces/office.interface.js';

export interface OfficeInfoResponse {
  name: string;
  officeHours: OfficeHours;
  estimatedTodayUsage: number;
}