/**
 * modules/simulator/simulator.service.ts
 *
 * Background simulator.
 * Every `intervalMs` ms it picks `min..max` random devices and toggles
 * their state. Runs in-process with the API — independent of the
 * Discord bot or socket layer.
 *
 * The simulator NEVER mutates the dashboard directly. It mutates the
 * database + emits socket events; the dashboard refreshes through its
 * normal channels.
 */

import { config } from '../../config/config.js';
import { databaseService } from '../../database/database.service.js';
import { logger } from '../../utils/logger.js';
import { nowISO } from '../../utils/time.js';
import { DeviceStatus, SocketEvent } from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import { deviceService } from '../devices/device.service.js';
import { buildOfficeUsage } from '../usage/usage.service.js';
import { socketService } from '../../socket/socket.service.js';

class SimulatorService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running || !config.simulator.enabled) return;
    this.running = true;
    logger.info(
      'simulator',
      `starting — every ${Math.round(config.simulator.intervalMs / 1000)}s flips ${config.simulator.minFlipPerTick}-${config.simulator.maxFlipPerTick} device(s)`
    );
    this.timer = setInterval(
      () => this.tick().catch((e) => logger.error('simulator', 'tick failed', e)),
      config.simulator.intervalMs
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    logger.info('simulator', 'stopped');
  }

  /** One iteration: pick N random devices, flip each, emit updates. */
  async tick(): Promise<void> {
    const devices = await databaseService.getDevices();
    if (devices.length === 0) return;
    const flipCount =
      config.simulator.minFlipPerTick +
      Math.floor(
        Math.random() * (config.simulator.maxFlipPerTick - config.simulator.minFlipPerTick + 1)
      );

    const candidates = [...devices];
    const toggled: Device[] = [];
    for (let i = 0; i < flipCount && candidates.length > 0; i++) {
      const idx = Math.floor(Math.random() * candidates.length);
      const picked = candidates.splice(idx, 1)[0];
      if (!picked) continue;
      const next =
        picked.status === DeviceStatus.ON
          ? Math.random() < 1 - config.simulator.onProbability
            ? DeviceStatus.ON
            : DeviceStatus.OFF
          : Math.random() < config.simulator.onProbability
            ? DeviceStatus.ON
            : DeviceStatus.OFF;
      const updated = await databaseService.updateDevice(picked.id, {
        status: next,
        lastChanged: nowISO(),
        afterHoursAlertSent: next === DeviceStatus.OFF ? false : picked.afterHoursAlertSent,
        runtimeAlertSent: next === DeviceStatus.OFF ? false : picked.runtimeAlertSent,
      });
      if (updated) {
        toggled.push(updated);
        socketService.emit(SocketEvent.DEVICE_UPDATED, updated);
      }
    }

    if (toggled.length > 0) {
      const all = await databaseService.getDevices();
      socketService.emit(SocketEvent.USAGE_UPDATED, buildOfficeUsage(all));
      logger.debug('simulator', `flipped ${toggled.length} device(s)`);
    }
    // touch deviceService so module-init side-effects (if added later) are kept warm.
    void deviceService;
  }
}

export const simulatorService = new SimulatorService();