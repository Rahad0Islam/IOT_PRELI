/**
 * interfaces/device.interface.ts
 *
 * Shape of a Device record as it lives in the database and crosses the wire.
 */

import type { DeviceStatus, DeviceType, Room } from '../types/enums.js';

export interface Device {
  /** UUID — keeps IDs stable across db resets. */
  id: string;
  /** Human label, e.g. "Fan 1" or "Light 3". Unique within a room. */
  name: string;
  type: DeviceType;
  room: Room;
  status: DeviceStatus;
  /** Static rated power draw in watts (when ON). */
  powerDraw: number;
  /** ISO 8601 timestamp of the last state change. */
  lastChanged: string;

  /**
   * Alert deduplication flags. Reset to false whenever the device goes OFF.
   * Stored as part of the device record (per spec) so they survive restarts.
   */
  afterHoursAlertSent: boolean;
  runtimeAlertSent: boolean;
}

/** A device returned to clients — strips nothing for now, but reserved for future redaction. */
export type DeviceDTO = Device;
