/**
 * interfaces/database.interface.ts
 *
 * Top-level shape of the LowDB JSON file.
 */

import type { Alert } from './alert.interface.js';
import type { Device } from './device.interface.js';
import type { OfficeConfig } from './office.interface.js';

export interface DatabaseShape {
  devices: Device[];
  alerts: Alert[];
  office: OfficeConfig;
}
