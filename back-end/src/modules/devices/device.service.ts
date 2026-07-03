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

const isValidRoom = (s: string): s is Room =>
  s === Room.DRAWING || s === Room.WORK_1 || s === Room.WORK_2;

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

    logger.info('devices', `toggle ${updated.room} / ${updated.name} -> ${updated.status}`);

    // Notify websocket subscribers.
    socketService.emit(SocketEvent.DEVICE_UPDATED, updated);

    // Re-publish current usage snapshot (power draw may have changed).
    const all = await databaseService.getDevices();
    socketService.emit(SocketEvent.USAGE_UPDATED, buildOfficeUsage(all));

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
