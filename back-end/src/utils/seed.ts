/**
 * utils/seed.ts
 *
 * Seeds `db.json` with 15 devices (2 fans + 3 lights × 3 rooms). Pure
 * function — receives the default file path so it can be invoked from
 * the database service on first boot.
 */

import { v4 as uuid } from 'uuid';
import {
  DeviceStatus,
  DeviceType,
  POWER_DRAW_WATTS,
  Room,
} from '../types/enums.js';
import type { DatabaseShape } from '../interfaces/database.interface.js';
import type { Device } from '../interfaces/device.interface.js';

/** Build the canonical 15-device seed. Deterministic IDs (uuid v4) for stability. */
export const buildSeed = (): DatabaseShape => {
  const devices: Device[] = [];
  const rooms = [Room.DRAWING, Room.WORK_1, Room.WORK_2];

  for (const room of rooms) {
    for (let i = 1; i <= 2; i++) {
      devices.push({
        id: uuid(),
        name: `Fan ${i}`,
        type: DeviceType.FAN,
        room,
        status: DeviceStatus.OFF,
        powerDraw: POWER_DRAW_WATTS[DeviceType.FAN],
        lastChanged: new Date().toISOString(),
        afterHoursAlertSent: false,
        runtimeAlertSent: false,
      });
    }
    for (let i = 1; i <= 3; i++) {
      devices.push({
        id: uuid(),
        name: `Light ${i}`,
        type: DeviceType.LIGHT,
        room,
        status: DeviceStatus.OFF,
        powerDraw: POWER_DRAW_WATTS[DeviceType.LIGHT],
        lastChanged: new Date().toISOString(),
        afterHoursAlertSent: false,
        runtimeAlertSent: false,
      });
    }
  }

  return {
    devices,
    alerts: [],
    office: {
      officeHours: { start: '09:00', end: '17:00' },
      estimatedTodayUsage: 0,
    },
  };
};
