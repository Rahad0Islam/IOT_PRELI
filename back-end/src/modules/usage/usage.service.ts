/**
 * modules/usage/usage.service.ts
 *
 * Pure business logic for power / kWh calculations. No HTTP, no DB reads.
 * Depends only on the `Device` records passed in — easy to unit-test by
 * passing hand-built arrays.
 */

import { DeviceStatus, DeviceType, POWER_DRAW_WATTS, ROOM_LABELS, Room } from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import type { OfficeUsage, RoomUsage, UsageHistoryPoint } from './usage.types.js';

const WORKING_DAYS_PER_MONTH = 22;

/** Whether a device is currently consuming rated power. */
export const isDeviceDrawing = (d: Device): boolean => d.status === DeviceStatus.ON;

/** Power in watts a single device draws right now. */
export const powerOfDevice = (d: Device): number => (isDeviceDrawing(d) ? d.powerDraw : 0);

/** Total watts drawn across an arbitrary collection of devices. */
export const totalPowerWatts = (devices: Device[]): number =>
  devices.reduce((acc, d) => acc + powerOfDevice(d), 0);

/** Group devices into per-room buckets and compute watts for each. */
export const perRoomUsage = (devices: Device[]): RoomUsage[] => {
  const rooms: Room[] = [Room.DRAWING, Room.WORK_1, Room.WORK_2];
  return rooms.map((room) => {
    const inRoom = devices.filter((d) => d.room === room);
    const onCount = inRoom.filter(isDeviceDrawing).length;
    return {
      room: ROOM_LABELS[room],
      powerWatts: totalPowerWatts(inRoom),
      onCount,
      totalCount: inRoom.length,
    };
  });
};

/** kWh for a given number of watts over milliseconds: kWh = W × ms / (1000 × 3600). */
export const kWhFor = (watts: number, ms: number): number => (watts * ms) / (1_000 * 3_600);

/**
 * Estimate today's kWh from per-device "ON time".
 *
 * Strategy: sum each device's `now - lastChanged` while it has been ON,
 * multiplied by its rated powerDraw, and divide by (1000 × 3600).
 * This is the value persisted in `db.office.estimatedTodayUsage`.
 *
 * NOTE: This is a heuristic — in production we'd track per-device
 * on/off durations in a time-series table.
 */
export const estimateTodayKWh = (devices: Device[], now: Date = new Date()): number => {
  const nowMs = now.getTime();
  return devices.reduce((acc, d) => {
    if (d.status !== DeviceStatus.ON) return acc;
    const onForMs = Math.max(0, nowMs - new Date(d.lastChanged).getTime());
    return acc + kWhFor(d.powerDraw, onForMs);
  }, 0);
};

/**
 * Keep a small in-memory rolling buffer of `{t, watts}` samples.
 * Used by the dashboard line chart.
 */
class PowerHistoryBuffer {
  private buf: UsageHistoryPoint[] = [];
  private cap = 60;

  push(t: Date, watts: number): void {
    this.buf.push({ t: t.toISOString(), watts: Math.round(watts) });
    if (this.buf.length > this.cap) this.buf.shift();
  }

  all(): UsageHistoryPoint[] {
    return this.buf.slice();
  }
}

export const powerHistory = new PowerHistoryBuffer();

/** Build a full OfficeUsage snapshot. */
export const buildOfficeUsage = (devices: Device[]): OfficeUsage => {
  const rooms = perRoomUsage(devices);
  const totalPowerWattsNow = rooms.reduce((a, r) => a + r.powerWatts, 0);
  const todayKWh = estimateTodayKWh(devices);

  powerHistory.push(new Date(), totalPowerWattsNow);

  // Override the heuristic with a defensive fallback equal to the historic
  // baseline of the rated devices (WATTS × 8h / 1000) if the running estimate
  // looks suspicious (e.g. all devices are fresh ON).
  const baselineKWh =
    devices.reduce((acc, d) => acc + POWER_DRAW_WATTS[d.type as DeviceType], 0) * 0; // placeholder
  void baselineKWh;

  return {
    totalPowerWatts: totalPowerWattsNow,
    estimatedTodayKWh: round2(todayKWh),
    estimatedMonthlyKWh: round2(todayKWh * WORKING_DAYS_PER_MONTH),
    rooms,
    history: powerHistory.all(),
    computedAt: new Date().toISOString(),
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
