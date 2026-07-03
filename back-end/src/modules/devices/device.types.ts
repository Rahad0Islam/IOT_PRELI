/**
 * modules/devices/device.types.ts
 *
 * Body shapes for device endpoints.
 */

export interface ToggleDeviceBody {
  /** Either the device id or its human name (e.g. "Fan 1"). */
  identifier: string;
  /**
   * Optional override target state. If omitted, the service flips the
   * current state. When provided it must be "ON" or "OFF".
   */
  status?: 'ON' | 'OFF';
}
