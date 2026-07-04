/**
 * modules/runtime/runtime.types.ts
 *
 * Shapes persisted by the Runtime Service.
 *
 * The runtime service is the single source of truth for "how long has this
 * device been ON". The Usage Service consumes those totals and turns them
 * into kWh. The Dashboard reads the totals directly through `/api/runtime`.
 *
 * One RuntimeRecord per device. `dailyHistory` is a sparse map keyed by
 * `YYYY-MM-DD`. We only track today's runtime — monthly totals are no
 * longer surfaced anywhere in the product.
 */

/**
 * Persisted per-device runtime record. Stored as-is inside
 * `runtime-history.json` under the `devices` array.
 */
export interface RuntimeRecord {
  /** Same as `Device.id` — primary key. */
  deviceId: string;
  /** Human label, e.g. "Fan 2". Cached for dashboards that don't want to join. */
  deviceName: string;
  /** Human room label, e.g. "Work Room 1". Cached for the same reason. */
  room: string;

  /**
   * ISO timestamp when the current ON session started.
   * `null` when the device is OFF (i.e. there is no active session).
   * Persisted across restarts — the spec says we never lose runtime when
   * the server goes down while a device is ON.
   */
  currentSessionStart: string | null;

  /** Cumulative ON-time counted *today*, in seconds. Resets at 00:00. */
  todayRuntimeSeconds: number;

  /** Cumulative ON-time ever recorded for this device, in seconds. Never reset. */
  totalRuntimeSeconds: number;

  /** ISO timestamp the record was last touched. */
  lastUpdated: string;

  /** Sparse map. `dailyHistory["2026-07-04"]` = seconds ON on 2026-07-04. */
  dailyHistory: Record<string, number>;
}

/**
 * Shape of the JSON file on disk. Exactly one entry per device in `devices`.
 * The list is sparse — devices that have never been ON simply don't appear
 * here (the runtime service creates records lazily on first ON event AND
 * during startup so all known devices are seeded up front).
 */
export interface RuntimeHistoryShape {
  /** Array of per-device runtime records. */
  devices: RuntimeRecord[];
  /** ISO timestamp of the last daily rollover (00:00 boundary). */
  lastDailyReset: string;
}

/**
 * Compact read-only snapshot returned by `runtimeService.snapshot()`.
 * This is what the dashboard consumes — totals only, not the whole daily
 * map, so the wire payload stays small.
 */
export interface RuntimeSnapshot {
  /** Per-device quick view. */
  devices: Array<{
    deviceId: string;
    deviceName: string;
    room: string;
    todayRuntimeSeconds: number;
    totalRuntimeSeconds: number;
    /** True when the device is currently ON and a session is being timed. */
    isCurrentlyOn: boolean;
    currentSessionStart: string | null;
  }>;
  /** Office-wide totals. Convenience for the dashboard hero numbers. */
  total: {
    todayRuntimeSeconds: number;
    /** Today's kWh across ALL devices. Computed from totals + per-device powerDraw. */
    todayKWh: number;
  };
  /** ISO timestamp the snapshot was built. */
  computedAt: string;
}
