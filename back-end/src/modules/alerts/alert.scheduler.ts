/**
 * modules/alerts/alert.scheduler.ts
 *
 * Runs `alertService.scan()` on a fixed interval.
 */

import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import { alertService } from './alert.service.js';

class AlertScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('alerts', `scheduler started — every ${Math.round(config.alerts.scanIntervalMs / 1000)}s`);
    this.timer = setInterval(
      () => alertService.scan().catch((err) => logger.error('alerts', 'scan failed', err)),
      config.alerts.scanIntervalMs
    );
    // Fire once on boot to catch devices already in an alarm state.
    alertService.scan().catch((err) => logger.error('alerts', 'initial scan failed', err));
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }
}

export const alertScheduler = new AlertScheduler();