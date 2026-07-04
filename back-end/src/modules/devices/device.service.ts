/**
 * modules/devices/device.service.ts
 *
 * Business logic for devices:
 *   - listing / fetching
 *   - toggling ON/OFF
 *   - room aggregation
 *
 * All persistence is delegated to `databaseService`. After any mutation we
 * emit a `device_updated` socket event so the dashboard refreshes without a
 * manual reload.
 */

import { databaseService } from '../../database/database.service.js';
import { socketService } from '../../socket/socket.service.js';
import { logger } from '../../utils/logger.js';
import { nowISO } from '../../utils/time.js';
import {
  DeviceStatus,
  DeviceType,
  Room,
  ROOM_LABELS,
  SocketEvent,
} from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import type { ToggleDeviceBody } from './device.types.js';
import { buildOfficeUsage } from '../usage/usage.service.js';
import { alertService } from '../alerts/alert.service.js';
import { runtimeService } from '../runtime/runtime.service.js';

const isValidRoom = (s: string): s is Room =>
  s === Room.DRAWING || s === Room.WORK_1 || s === Room.WORK_2;

/**
 * Shared "a device changed" handler.
 *
 * Every code path that mutates a device (REST toggle, simulator tick,
 * future ESP32 webhook) MUST go through this so:
 *   1. The 60s scheduler's job is preserved (it still runs `scan()` to
 *      catch devices that cross the runtime threshold WITHOUT any new
 *      event — e.g. nobody touches them for 2h).
 *   2. The IMMEDIATE alert check fires off `evaluateNow(updated)` BEFORE
 *      the `device_updated` socket emit so the dashboard, the bot, and
 *      the alert log all see a coherent snapshot.
 *   3. The `device_updated` + `usage_updated` socket emit happens once,
 *      in one place.
 */
async function applyChange(updated: Device): Promise<void> {
  logger.info('devices', `change ${updated.room} / ${updated.name} -> ${updated.status}`);
  // (a) Live alert check — fires AFTER_HOURS the moment a device goes ON
  //     outside office hours, and fires CONTINUOUS_RUNTIME the moment a
  //     device that's already past the threshold gets refreshed.
  try {
    await alertService.evaluateNow(updated);
  } catch (err) {
    logger.warn('devices', 'immediate alert check failed', err);
  }

  // (b) Runtime tracking — open or close the session, fold the delta into
  //     the persistent totals. Best-effort: a runtime-tracking failure
  //     must never block the device change from being published.
  try {
    await runtimeService.onDeviceChanged(updated);
  } catch (err) {
    logger.warn('devices', 'runtime tracking update failed', err);
  }

  // (c) Push the change to the dashboard over Socket.IO.
  socketService.emit(SocketEvent.DEVICE_UPDATED, updated);

  // (d) Re-publish the office-wide usage snapshot. Read fresh in case the
  //     alert check above flipped any dedup flags.
  const all = await databaseService.getDevices();
  const usage = buildOfficeUsage(all, await runtimeService.snapshot());
  socketService.emit(SocketEvent.USAGE_UPDATED, usage);
}

export const deviceService = {
  /** All devices, sorted by room then name. */
  async list(): Promise<Device[]> {
    const all = await databaseService.getDevices();
    return all
      .slice()
      .sort((a, b) => {
        if (a.room !== b.room) return a.room.localeCompare(b.room);
        // Within a room, group by type then numeric suffix of name.
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });
  },

  async getById(id: string): Promise<Device | null> {
    return databaseService.getDeviceById(id);
  },

  /**
   * Resolve a device by either id or human name (optionally scoped to a room).
   * "Fan 2" or "Drawing Room · Light 1" — both work.
   */
  async resolve(identifier: string): Promise<Device | null> {
    const list = await databaseService.getDevices();
    const direct = list.find((d) => d.id === identifier);
    if (direct) return direct;
    return list.find((d) => d.name === identifier) ?? null;
  },

  /**
   * Toggle (or set) the state of a device.
   * Returns the updated device or null if not found.
   */
  async toggle(body: ToggleDeviceBody): Promise<Device | null> {
    const device = await this.resolve(body.identifier);
    if (!device) return null;
    const nextStatus: DeviceStatus =
      body.status === 'ON' || body.status === 'OFF'
        ? (body.status as DeviceStatus)
        : device.status === DeviceStatus.ON
          ? DeviceStatus.OFF
          : DeviceStatus.ON;

    const lastChanged = nowISO();
    const updated = await databaseService.updateDevice(device.id, {
      status: nextStatus,
      lastChanged,
      // Reset dedup flags whenever the device goes OFF — clear "memory" of alerts.
      afterHoursAlertSent: nextStatus === DeviceStatus.OFF ? false : device.afterHoursAlertSent,
      runtimeAlertSent: nextStatus === DeviceStatus.OFF ? false : device.runtimeAlertSent,
    });
    if (!updated) return null;

    // Delegate to the shared change handler so toggle + simulator behave identically.
    await applyChange(updated);
    return updated;
  },

  /** Group all devices by room for the dashboard / bot. */
  async groupedByRoom(): Promise<Record<string, Device[]>> {
    const all = await this.list();
    const result: Record<string, Device[]> = {};
    for (const room of Object.values(Room)) {
      if (!isValidRoom(room)) continue;
      result[ROOM_LABELS[room as Room]] = all.filter((d) => d.room === room);
    }
    return result;
  },

  /** Devices in a single room, looked up by room enum. */
  async forRoom(room: string): Promise<Device[]> {
    const all = await this.list();
    if (!isValidRoom(room)) return [];
    return all.filter((d) => d.room === room);
  },

  /**
   * Apply a pre-decided status change WITHOUT going through the toggle
   * endpoint. Used by the simulator (which has already picked the random
   * next state) and by future ESP32 webhooks (which already know the
   * relay's actual state).
   *
   * Routes through the same `applyChange` pipeline as `toggle()` so the
   * immediate alert check + socket emits happen identically regardless of
   * the trigger source.
   */
  async applyStatus(deviceId: string, nextStatus: DeviceStatus): Promise<Device | null> {
    const devices = await databaseService.getDevices();
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return null;

    const updated = await databaseService.updateDevice(device.id, {
      status: nextStatus,
      lastChanged: nowISO(),
      // Reset dedup flags when a device goes OFF — clears alert "memory".
      afterHoursAlertSent:
        nextStatus === DeviceStatus.OFF ? false : device.afterHoursAlertSent,
      runtimeAlertSent:
        nextStatus === DeviceStatus.OFF ? false : device.runtimeAlertSent,
    });
    if (!updated) return null;

    await applyChange(updated);
    return updated;
  },

  /** Count devices of a given type / room — handy for the bot summary. */
  async summary(): Promise<{
    totalDevices: number;
    fansOn: number;
    lightsOn: number;
    fansOff: number;
    lightsOff: number;
  }> {
    const all = await databaseService.getDevices();
    const isOn = (d: Device): boolean => d.status === DeviceStatus.ON;
    return {
      totalDevices: all.length,
      fansOn: all.filter((d) => d.type === DeviceType.FAN && isOn(d)).length,
      lightsOn: all.filter((d) => d.type === DeviceType.LIGHT && isOn(d)).length,
      fansOff: all.filter((d) => d.type === DeviceType.FAN && !isOn(d)).length,
      lightsOff: all.filter((d) => d.type === DeviceType.LIGHT && !isOn(d)).length,
    };
  },
};
