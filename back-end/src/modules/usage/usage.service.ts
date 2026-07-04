/**
 * modules/usage/usage.service.ts
 *
 * Pure business logic for power / kWh calculations. No HTTP, no DB reads.
 *
 * Historical note
 * ---------------
 * The first version of this file computed "today's kWh" from each device's
 * `lastChanged` timestamp. That number was wrong the moment a device
 * turned OFF (its accumulated runtime disappeared) and the monthly total
 * was just `today × 22 working days`. The runtime-tracking module
 * (`modules/runtime`) is now the source of truth for runtime totals; this
 * file consumes the `RuntimeSnapshot` it returns.
 */

import { DeviceStatus, ROOM_LABELS, Room } from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import type { OfficeUsage, RoomUsage, UsageHistoryPoint } from './usage.types.js';
import type { RuntimeSnapshot } from '../runtime/runtime.types.js';

/** Whether a device is currently consuming rated power. */
export const isDeviceDrawing = (d: Device): boolean => d.status === DeviceStatus.ON;
/** Power in watts a single device draws right now. */
export const powerOfDevice = (d: Device): number => (isDeviceDrawing(d) ? d.powerDraw : 0);
/** Total watts drawn across an arbitrary collection of devices. */
export const totalPowerWatts = (devices: Device[]): number =>
  devices.reduce((acc, d) => acc + powerOfDevice(d), 0);

/** kWh for a given number of watts over seconds: kWh = W × (s/3600) / 1000. */
export const kWhFor = (watts: number, seconds: number): number =>
  (watts * (seconds / 3_600)) / 1_000;

/**
 * Group devices into per-room buckets. Today's / month's kWh per room come
 * from the runtime snapshot — we look up the running totals by deviceId
 * so they survive OFF→ON→OFF→ON transitions and restarts.
 */
export const perRoomUsage = (devices: Device[], runtime: RuntimeSnapshot): RoomUsage[] => {
  const rooms: Room[] = [Room.DRAWING, Room.WORK_1, Room.WORK_2];
  const runtimeById = new Map(runtime.devices.map((r) => [r.deviceId, r]));
  return rooms.map((room) => {
    const inRoom = devices.filter((d) => d.room === room);
    const onCount = inRoom.filter(isDeviceDrawing).length;
    const powerWattsRoom = totalPowerWatts(inRoom);
    return {
      room: ROOM_LABELS[room],
      powerWatts: powerWattsRoom,
      onCount,
      totalCount: inRoom.length,
      // Per-room kWh is the sum of (each device's own powerDraw × its
      // runtime seconds). We deliberately do NOT multiply by the room's
      // instantaneous watts — that would penalise a room that just turned
      // a device OFF.
      todayKWh: sumPerDeviceKWh(inRoom, runtimeById),
    };
  });
};

/** Sum kWh across a device list using each device's own powerDraw. */
const sumPerDeviceKWh = (
  devices: Device[],
  runtimeById: Map<string, RuntimeSnapshot['devices'][number]>
): number => {
  let acc = 0;
  for (const d of devices) {
    const r = runtimeById.get(d.id);
    if (!r) continue;
    acc += kWhFor(d.powerDraw, r.todayRuntimeSeconds);
  }
  // Per-room kWh is rounded to 3 decimal places (= watt-hour resolution).
  // Rounding to 2dp would discard sub-0.005 kWh values (a fan running for
  // ~1 minute, or any small room) and visually display them as "0.00 kWh"
  // even though energy was clearly consumed. The office-level hero numbers
  // are rounded to 2dp exactly once in `snapshot()`; this function is only
  // for the per-room breakdown cards.
  return round3(acc);
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

/**
 * Build a full OfficeUsage snapshot.
 *
 * Today's and month's kWh now come from the persistent runtime history
 * (passed in as `runtime`). The instantaneous power figure still comes
 * from the live device list — those are different signals and shouldn't
 * be conflated.
 */
export const buildOfficeUsage = (
  devices: Device[],
  runtime: RuntimeSnapshot
): OfficeUsage => {
  const rooms = perRoomUsage(devices, runtime);
  const totalPowerWattsNow = rooms.reduce((a, r) => a + r.powerWatts, 0);

  powerHistory.push(new Date(), totalPowerWattsNow);

  return {
    totalPowerWatts: totalPowerWattsNow,
    estimatedTodayKWh: runtime.total.todayKWh,
    rooms,
    history: powerHistory.all(),
    runtime,
    computedAt: new Date().toISOString(),
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Round to 3 decimal places. Used for per-room kWh so sub-5Wh values aren't
 *  displayed as 0.00. */
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
