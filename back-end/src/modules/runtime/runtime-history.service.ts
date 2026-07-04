/**
 * modules/runtime/runtime-history.service.ts
 *
 * Persistence layer for runtime records. Owns `runtime-history.json`
 * exclusively — no other module touches that file.
 *
 * This is a separate file from `database.service.ts` on purpose:
 *   - `database.service.ts` (the existing LowDB wrapper) owns `db.json`
 *     which carries the device list + alert log + office config.
 *   - `runtime-history.service.ts` owns a different concern (per-device
 *     runtime totals + daily history) and writes to its own file so a
 *     corrupt or bloated history doesn't break the rest of the app.
 *
 * Both files use LowDB. The schema is intentionally tiny and the only
 * write paths are `upsertRecord` / `replaceAll`, so contention is minimal.
 */

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

import { config } from '../../config/config.js';
import { logger } from '../../utils/logger.js';
import type { RuntimeHistoryShape, RuntimeRecord } from './runtime.types.js';

/**
 * Build the empty file shape.
 *
 * `lastDailyReset` is set to the start of the current day in local time
 * so a fresh install doesn't immediately trigger a rollover on the first
 * tick.
 */
const emptyShape = (): RuntimeHistoryShape => {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    devices: [],
    lastDailyReset: dayStart.toISOString(),
  };
};

class RuntimeHistoryService {
  private db: Low<RuntimeHistoryShape> | null = null;
  private filePath: string;

  constructor() {
    this.filePath = config.paths.runtimeHistoryFile;
  }

  /**
   * Load the JSON file from disk. Safe to call multiple times — subsequent
   * calls are no-ops once `db` is set.
   */
  async init(): Promise<void> {
    if (this.db) return;
    const adapter = new JSONFile<RuntimeHistoryShape>(this.filePath);
    const db = new Low<RuntimeHistoryShape>(adapter, emptyShape());
    await db.read();
    // First-run / corrupted file → seed empty.
    if (!db.data) {
      db.data = emptyShape();
      await db.write();
      logger.info('runtime-db', `Seeded runtime-history.json at ${this.filePath}`);
    } else {
      // Defensive migration for older files: ensure the top-level shape.
      db.data.devices ??= [];
      db.data.lastDailyReset ??= new Date().toISOString();
      await db.write();
    }
    this.db = db;
    logger.info(
      'runtime-db',
      `Loaded runtime history for ${db.data.devices.length} device(s)`
    );
  }

  /** Throws if init wasn't called. */
  private getDb(): Low<RuntimeHistoryShape> {
    if (!this.db) throw new Error('RuntimeHistoryService used before init()');
    return this.db;
  }

  /** Return all records as a fresh array (copy, not live reference). */
  async getAll(): Promise<RuntimeRecord[]> {
    return JSON.parse(JSON.stringify(this.getDb().data!.devices)) as RuntimeRecord[];
  }

  /** Read a single record (returns `null` if the device has no record yet). */
  async getRecord(deviceId: string): Promise<RuntimeRecord | null> {
    const rec = this.getDb().data!.devices.find((d) => d.deviceId === deviceId);
    return rec ? (JSON.parse(JSON.stringify(rec)) as RuntimeRecord) : null;
  }

  /**
   * Replace the record for a device (matched by `deviceId`). Persists to
   * disk synchronously so the caller doesn't need to remember to save —
   * runtime totals are the kind of data we never want to lose on crash.
   *
   * If the record doesn't exist yet, it's appended.
   */
  async upsertRecord(record: RuntimeRecord): Promise<void> {
    const db = this.getDb();
    const idx = db.data!.devices.findIndex((d) => d.deviceId === record.deviceId);
    if (idx === -1) db.data!.devices.push(record);
    else db.data!.devices[idx] = record;
    await db.write();
  }

  /** Bulk-replace the whole list — used by midnight rollover. */
  async replaceAll(records: RuntimeRecord[]): Promise<void> {
    const db = this.getDb();
    db.data!.devices = records;
    await db.write();
  }

  /** Update `lastDailyReset` marker without touching records. */
  async setLastDailyReset(iso: string): Promise<void> {
    const db = this.getDb();
    db.data!.lastDailyReset = iso;
    await db.write();
  }

  async getLastDailyReset(): Promise<string> {
    return this.getDb().data!.lastDailyReset;
  }

  /** File path — exposed for diagnostics / tests. */
  path(): string {
    return this.filePath;
  }
}

export const runtimeHistoryService = new RuntimeHistoryService();