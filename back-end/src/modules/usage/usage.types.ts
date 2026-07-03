/**
 * modules/usage/usage.types.ts
 *
 * Shapes returned by the /api/usage endpoints.
 */

export interface RoomUsage {
  room: string;
  /** Watts being drawn by ON devices in this room right now. */
  powerWatts: number;
  /** # of devices ON in this room. */
  onCount: number;
  /** Total # of devices in this room. */
  totalCount: number;
}

export interface OfficeUsage {
  /** Aggregate instantaneous office draw, in watts. */
  totalPowerWatts: number;
  /** kWh estimated for *today*. Persisted in `db.office.estimatedTodayUsage`. */
  estimatedTodayKWh: number;
  /** kWh estimated for the full month (heuristic: today × 22 working days). */
  estimatedMonthlyKWh: number;
  /** Per-room breakdown. */
  rooms: RoomUsage[];
  /** Most recent ON transitions across the office (for the line chart). */
  history: UsageHistoryPoint[];
  /** ISO timestamp the snapshot was computed at. */
  computedAt: string;
}

export interface UsageHistoryPoint {
  /** ISO timestamp for the bucket. */
  t: string;
  /** Watts at that bucket. */
  watts: number;
}
