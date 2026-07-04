/**
 * modules/alerts/alert.service.ts
 *
 * Alert engine.
 *
 * Two rules (see SPEC), evaluated INDEPENDENTLY for every device:
 *   1. AFTER_HOURS
 *      A device is ON while the wall-clock is OUTSIDE the office window
 *      defined by `OFFICE_START_HOUR` / `OFFICE_END_HOUR` (integer hours,
 *      loaded in config.ts).
 *      - Office window is `[start, end)` — i.e. start inclusive, end
 *        exclusive, so 17:00 sharp is already after-hours.
 *      - Cross-midnight windows (start > end, e.g. 22 → 06) are supported.
 *
 *   2. CONTINUOUS_RUNTIME
 *      A device has been continuously ON for at least
 *      `DEVICE_RUNTIME_ALERT_MINUTES` minutes. Independent of office hours.
 *
 * Dedup:
 *   Each device carries `afterHoursAlertSent` and `runtimeAlertSent`
 *   flags. We only push an alert for a (device, type) pair once. Both
 *   flags reset to `false` when the device flips OFF (see device.service).
 *   This guarantees:
 *     - No repeated alerts every scan tick while the condition stays true.
 *     - Toggling the device OFF then ON again naturally re-arms the alert.
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
    const now = new Date();

    // Debug: log the office-hour window + whether "now" is inside it.
    const inHours = isWithinOfficeHours(config.office.start, config.office.end, now);
    logger.debug(
      'alerts',
      `current=${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ` +
        `office=${config.office.start}-${config.office.end} ` +
        `isAfterHours=${String(!inHours)}`
    );

    for (const device of devices) {
      const a = await this.evaluateDevice(device, now);
      if (a) triggered.push(a);
    }
    if (triggered.length > 0) {
      logger.info('alerts', `scan triggered ${triggered.length} new alert(s)`);
    }
    return triggered;
  }

  /**
   * Evaluate a single device against both alert rules and persist any
   * resulting Alert. Rules are independent — both may match in the same
   * scan, but dedup flags prevent duplicates on subsequent scans.
   */
  private async evaluateDevice(device: Device, now: Date): Promise<Alert | null> {
    if (device.status !== DeviceStatus.ON) return null;

    const inHours = isWithinOfficeHours(config.office.start, config.office.end, now);
    const onMs = msSince(device.lastChanged);
    const threshold = config.alerts.continuousRuntimeMs;

    let lastPushed: Alert | null = null;

    // ---- Rule 1: After Hours (independent of runtime) ----
    if (!inHours && !device.afterHoursAlertSent) {
      const alert = await this.pushAlert({
        type: AlertType.AFTER_HOURS,
        severity: AlertSeverity.CRITICAL,
        title: `${ROOM_LABELS[device.room]} · ${device.name} left ON after hours`,
        message:
          `It is outside office hours (${config.office.start}–${config.office.end}) ` +
          `and ${ROOM_LABELS[device.room]} / ${device.name} is still ON (${device.powerDraw} W).`,
        deviceId: device.id,
        deviceName: device.name,
        room: ROOM_LABELS[device.room],
        triggeredAt: nowISO(),
      });
      await databaseService.updateDevice(device.id, { afterHoursAlertSent: true });
      await this.broadcast(alert);
      lastPushed = alert;
    }

    // ---- Rule 2: Continuous Runtime (independent of office hours) ----
    if (onMs >= threshold && !device.runtimeAlertSent) {
      const alert = await this.pushAlert({
        type: AlertType.CONTINUOUS_RUNTIME,
        severity: AlertSeverity.WARNING,
        title: `${ROOM_LABELS[device.room]} · ${device.name} ON for ${msToHumanDuration(onMs)}`,
        message:
          `${ROOM_LABELS[device.room]} / ${device.name} has been continuously ON for ` +
          `${msToHumanDuration(onMs)} (threshold: ${msToHumanDuration(threshold)}).`,
        deviceId: device.id,
        deviceName: device.name,
        room: ROOM_LABELS[device.room],
        triggeredAt: nowISO(),
      });
      await databaseService.updateDevice(device.id, { runtimeAlertSent: true });
      await this.broadcast(alert);
      lastPushed = alert;
    }

    return lastPushed;
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