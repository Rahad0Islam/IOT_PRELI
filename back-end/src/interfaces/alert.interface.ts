/**
 * interfaces/alert.interface.ts
 *
 * Shape of a single alert event written to `db.alerts` and surfaced by the API.
 */

import type { AlertSeverity, AlertType } from '../types/enums.js';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  /** Friendly headline, e.g. "Drawing Room · Fan 1 still ON after 5 PM". */
  title: string;
  /** Longer human description of what happened. */
  message: string;
  /** Reference to the device that triggered this alert. */
  deviceId: string;
  deviceName: string;
  room: string;
  /** ISO timestamp of when the alert was created. */
  triggeredAt: string;
}

export type AlertDTO = Alert;
