/**
 * modules/alerts/alert.service.ts
 *
 * Alert engine.
 *
 * Two rules (see SPEC):
 *   1. AFTER_HOURS     — a device is ON outside office hours.
 *   2. CONTINUOUS_RUNTIME — a device has been continuously ON for > 2h.
 *
 * Dedup: each device carries `afterHoursAlertSent` and `runtimeAlertSent`
 * flags. We only push a new alert for a (device, type) pair once, and we
 * clear the flag the moment the device goes OFF (see device.service).
 */

import { config } from '../../config/config.js';
import { databaseService } from '../../database/database.service.js';
import { logger } from '../../utils/logger.js';
import { isWithinOfficeHours, msSince, msToHumanDuration, nowISO } from '../../utils/time.js';
import { AlertSeverity, AlertType, DeviceStatus, ROOM_LABELS } from '../../types/enums.js';
import type { Alert } from '../../interfaces/alert.interface.js';
import type { Device } from '../../interfaces/device.interface.js';
import { buildOfficeUsage } from '../usage/usage.service.js';
import { socketService } from '../../socket/socket.service.js';
import { SocketEvent } from '../../types/enums.js';
import { discordService } from '../discord/discord.service.js';

class AlertService {
  /** Scan all devices and emit any newly-detected alerts. */
  async scan(): Promise<Alert[]> {
    const devices = await databaseService.getDevices();
    const triggered: Alert[] = [];

    for (const device of devices) {
      const a = await this.evaluateDevice(device);
      if (a) triggered.push(a);
    }
    if (triggered.length > 0) {
      logger.info('alerts', `scan triggered ${triggered.length} new alert(s)`);
    }
    return triggered;
  }

  /**
   * Evaluate a single device against both alert rules and persist
   * any resulting Alert. Returns the newly-pushed Alert or null.
   */
  private async evaluateDevice(device: Device): Promise<Alert | null> {
    if (device.status !== DeviceStatus.ON) return null;

    // -- Rule 1: After Hours --
    const afterHours = !isWithinOfficeHours(
      config.office.start,
      config.office.end,
      new Date()
    );

    if (afterHours && !device.afterHoursAlertSent) {
      const alert = await this.pushAlert({
        type: AlertType.AFTER_HOURS,
        severity: AlertSeverity.CRITICAL,
        title: `${ROOM_LABELS[device.room]} · ${device.name} left ON after hours`,
        message: `It is outside office hours (${config.office.start}–${config.office.end}) and ${ROOM_LABELS[device.room]} / ${device.name} is still ON (${device.powerDraw} W).`,
        deviceId: device.id,
        deviceName: device.name,
        room: ROOM_LABELS[device.room],
        triggeredAt: nowISO(),
      });
      await databaseService.updateDevice(device.id, { afterHoursAlertSent: true });
      await this.broadcast(alert);
      return alert;
    }

    // -- Rule 2: Continuous Runtime --
    const onMs = msSince(device.lastChanged);
    if (
      onMs >= config.alerts.continuousRuntimeMs &&
      !device.runtimeAlertSent
    ) {
      const alert = await this.pushAlert({
        type: AlertType.CONTINUOUS_RUNTIME,
        severity: AlertSeverity.WARNING,
        title: `${ROOM_LABELS[device.room]} · ${device.name} ON for ${msToHumanDuration(onMs)}`,
        message: `${ROOM_LABELS[device.room]} / ${device.name} has been continuously ON for ${msToHumanDuration(onMs)} (threshold: ${msToHumanDuration(config.alerts.continuousRuntimeMs)}).`,
        deviceId: device.id,
        deviceName: device.name,
        room: ROOM_LABELS[device.room],
        triggeredAt: nowISO(),
      });
      await databaseService.updateDevice(device.id, { runtimeAlertSent: true });
      await this.broadcast(alert);
      return alert;
    }

    return null;
  }

  private async pushAlert(input: Omit<Alert, 'id'>): Promise<Alert> {
    return databaseService.pushAlert(input);
  }

  private async broadcast(alert: Alert): Promise<void> {
    socketService.emit(SocketEvent.ALERT_TRIGGERED, alert);
    // Re-publish usage snapshot so the dashboard reflects any drift.
    const devices = await databaseService.getDevices();
    socketService.emit(SocketEvent.USAGE_UPDATED, buildOfficeUsage(devices));
    // Best-effort Discord notification (no-op if bot is disabled).
    discordService.notifyAlert(alert).catch((err) => {
      logger.warn('alerts', 'discord notify failed', err);
    });
  }

  async list(): Promise<Alert[]> {
    return databaseService.getAlerts();
  }

  async clear(): Promise<void> {
    return databaseService.clearAlerts();
  }
}

export const alertService = new AlertService();