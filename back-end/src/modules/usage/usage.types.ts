/**
 * modules/usage/usage.types.ts
 *
 * Shapes returned by the /api/usage endpoints.
 */

import type { RuntimeSnapshot } from '../runtime/runtime.types.js';

export interface RoomUsage {
  room: string;
  /** Watts being drawn by ON devices in this room right now. */
  powerWatts: number;
  /** # of devices ON in this room. */
  onCount: number;
  /** Total # of devices in this room. */
  totalCount: number;
  /** kWh accumulated in this room today, derived from the runtime history. */
  todayKWh: number;
}

export interface OfficeUsage {
  /** Aggregate instantaneous office draw, in watts. */
  totalPowerWatts: number;
  /**
   * kWh accumulated today. Now sourced from the persistent runtime history
   * (`RuntimeSnapshot.total.todayKWh`) so the number survives device
   * toggles and server restarts.
   */
  estimatedTodayKWh: number;
  /** Per-room breakdown. */
  rooms: RoomUsage[];
  /** Most recent ON transitions across the office (for the line chart). */
  history: UsageHistoryPoint[];
  /**
   * Optional runtime snapshot — included so clients that hit /api/usage
   * still get per-device runtime totals without a second fetch.
   */
  runtime?: RuntimeSnapshot;
  /** ISO timestamp the snapshot was computed at. */
  computedAt: string;
}

export interface UsageHistoryPoint {
  /** ISO timestamp for the bucket. */
  t: string;
  /** Watts at that bucket. */
  watts: number;
}
