/**
 * modules/runtime/runtime.service.ts
 *
 * Runtime tracking engine — the single source of truth for "how long has
 * each device been ON".
 *
 * Why this exists
 * ---------------
 * The previous "Today's Estimated Usage" / "Monthly Estimated Usage" values
 * were computed from `device.lastChanged`, which is only ever the start of
 * the *current* ON session. The moment a device turned OFF, its accumulated
 * runtime disappeared from the formula. Numbers reset every time a device
 * flipped, and monthly totals were simply `today × 22 working days`.
 *
 * This service replaces that with a real time-series:
 *   1. When a device goes ON, we record `currentSessionStart`.
 *   2. Every 30 seconds, while a device is ON, we add the elapsed delta
 *      to the persisted totals and write the file. The dashboard's "today"
 *      number therefore ticks upward in real time.
 *   3. When a device goes OFF, we close the session, fold the final delta
 *      into the totals, and clear `currentSessionStart`.
 *   4. At 00:00 we do a daily rollover (and at 00:00 on day 1 a monthly
 *      rollover), splitting any running session at the boundary.
 *   5. On startup, we rehydrate from disk. If a device is currently ON and
 *      has `currentSessionStart`, we keep counting from that timestamp —
 *      no runtime is lost when the server restarts.
 *
 * The Usage Service is the only consumer of the totals (`snapshot()`).
 * The Device Service calls `onDeviceChanged(updated)` from `applyChange()`.
 * Nothing else in the codebase needs to know about runtime.
 *
 * Threading model: Node is single-threaded, but the simulator, the alert
 * scheduler and the runtime tick all share the same event loop. Every
 * mutation goes through the methods on this class, so internal state is
 * consistent without locking.
 */

import { config } from '../../config/config.js';
import { databaseService } from '../../database/database.service.js';
import { logger } from '../../utils/logger.js';
import { nowISO } from '../../utils/time.js';
import { ROOM_LABELS, Room, DeviceStatus } from '../../types/enums.js';
import type { Device } from '../../interfaces/device.interface.js';
import { runtimeHistoryService } from './runtime-history.service.js';
import type { RuntimeRecord, RuntimeSnapshot } from './runtime.types.js';

// ---------------------------------------------------------------------------
// Small pure helpers — kept module-local because they are only useful here.
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in local time (matches the user-visible calendar day). */
const ymd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** YYYY-MM in local time. */
const ym = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Start-of-day Date for the given Date (local time, midnight). */
const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

/** Start-of-month Date for the given Date (local time, day 1 at 00:00). */
const startOfMonth = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

/** Floor a millisecond delta to whole seconds (runtimes are reported in seconds). */
const msToSeconds = (ms: number): number => Math.max(0, Math.floor(ms / 1000));

/** Stable kWh for a watts×seconds pair. */
const kWhFor = (watts: number, seconds: number): number =>
  (watts * (seconds / 3_600)) / 1_000;

/** Build an empty record for a device. */
const emptyRecord = (device: Device): RuntimeRecord => {
  const roomLabel = ROOM_LABELS[device.room as Room] ?? String(device.room);
  return {
    deviceId: device.id,
    deviceName: device.name,
    room: roomLabel,
    currentSessionStart: null,
    todayRuntimeSeconds: 0,
    monthRuntimeSeconds: 0,
    totalRuntimeSeconds: 0,
    lastUpdated: nowISO(),
    dailyHistory: {},
    monthlyHistory: {},
  };
};

class RuntimeService {
  private tickTimer: NodeJS.Timeout | null = null;
  private nextDailyResetCheck: Date | null = null;
  private nextMonthlyResetCheck: Date | null = null;
  private initialized = false;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialise the runtime store from disk, then seed any missing device
   * records. Call this AFTER `databaseService.init()` and before
   * `simulatorService.start()` so the seed sees every known device.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await runtimeHistoryService.init();
    await this.seedMissingRecords();
    // Anchor the next-rollover checks to the next midnight / next month
    // boundary so the first tick doesn't immediately fire a rollover for
    // devices installed minutes before midnight.
    const now = new Date();
    this.nextDailyResetCheck = this.nextMidnight(now);
    this.nextMonthlyResetCheck = this.nextMonthStart(now);
    this.initialized = true;
    logger.info(
      'runtime',
      `initialised — next daily reset ${this.nextDailyResetCheck.toISOString()}, ` +
        `next monthly reset ${this.nextMonthlyResetCheck.toISOString()}`
    );
  }

  /**
   * Start the background tick. The tick does THREE things:
   *   1. For every device currently ON, fold the elapsed-since-last-write
   *      delta into the totals and persist (so a crash loses at most
   *      `RUNTIME_TICK_INTERVAL_MS` of data per device).
   *   2. Check whether we've crossed a daily / monthly boundary and run the
   *      corresponding rollover.
   *   3. Emit a fresh snapshot.
   */
  start(): void {
    if (this.tickTimer) return;
    const intervalMs = config.runtime.tickIntervalMs;
    logger.info('runtime', `tick every ${Math.round(intervalMs / 1000)}s`);
    this.tickTimer = setInterval(() => {
      this.tick().catch((e) => logger.error('runtime', 'tick failed', e));
    }, intervalMs);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    logger.info('runtime', 'stopped');
  }

  isRunning(): boolean {
    return this.tickTimer !== null;
  }

  // -------------------------------------------------------------------------
  // Public API — called by DeviceService when a device changes
  // -------------------------------------------------------------------------

  /**
   * Notify the runtime service that a device just changed state.
   *
   * Behaviour:
   *   - OFF → ON  : record `currentSessionStart = now`, do NOT add runtime
   *     yet (no time has elapsed).
   *   - ON  → OFF : close the session, fold the delta into today/month/
   *     total, append to `dailyHistory[YYYY-MM-DD]` and
   *     `monthlyHistory[YYYY-MM]`, clear `currentSessionStart`, persist.
   *   - ON  → ON  (no change in status, e.g. lastChanged bumped): ignored —
   *     the live tick handles accumulation.
   *
   * The matching record is created on-demand if missing, so the service is
   * safe to call BEFORE `init()` has had a chance to seed — e.g. from a
   * simulated toggle on a fresh install.
   */
  async onDeviceChanged(device: Device, now: Date = new Date()): Promise<void> {
    if (!this.initialized) await this.init();

    const existing = await runtimeHistoryService.getRecord(device.id);
    const rec = existing ?? emptyRecord(device);

    if (device.status === DeviceStatus.ON) {
      // OFF -> ON, or first-time ON for a device with no record.
      if (rec.currentSessionStart === null) {
        rec.currentSessionStart = now.toISOString();
        rec.lastUpdated = now.toISOString();
        await runtimeHistoryService.upsertRecord(rec);
        logger.debug('runtime', `session open  ${rec.deviceName} @ ${rec.currentSessionStart}`);
      }
      // ON -> ON with a session already in flight: nothing to do (tick handles it).
      return;
    }

    // device.status === OFF: close the session if one is open.
    if (rec.currentSessionStart === null) {
      // Device was OFF all along, or session was already closed. Persist a
      // lastUpdated touch so callers can see we saw the event.
      rec.lastUpdated = now.toISOString();
      await runtimeHistoryService.upsertRecord(rec);
      return;
    }
    const sessionStart = new Date(rec.currentSessionStart).getTime();
    const nowMs = now.getTime();
    if (nowMs > sessionStart) {
      const deltaSec = msToSeconds(nowMs - sessionStart);
      this.applyDelta(rec, deltaSec, now);
      logger.debug(
        'runtime',
        `session close ${rec.deviceName} +${deltaSec}s -> today=${rec.todayRuntimeSeconds}s month=${rec.monthRuntimeSeconds}s total=${rec.totalRuntimeSeconds}s`
      );
    }
    rec.currentSessionStart = null;
    rec.lastUpdated = now.toISOString();
    await runtimeHistoryService.upsertRecord(rec);
  }

  // -------------------------------------------------------------------------
  // Snapshot / read access
  // -------------------------------------------------------------------------

  /**
   * Build an in-memory snapshot of every device's runtime + office-wide
   * totals. Returns a *plain* object — safe to JSON-serialise for the API
   * or for a socket payload.
   *
   * For currently-ON devices, the "live" seconds are included in the totals
   * (so the dashboard number is up-to-the-second even between disk writes).
   */
  async snapshot(now: Date = new Date()): Promise<RuntimeSnapshot> {
    if (!this.initialized) await this.init();
    const devices = await databaseService.getDevices();
    const records = await runtimeHistoryService.getAll();
    const byId = new Map(records.map((r) => [r.deviceId, r]));

    let totalToday = 0;
    let totalMonth = 0;
    let todayKWh = 0;
    let monthKWh = 0;

    const snapDevices: RuntimeSnapshot['devices'] = [];

    for (const d of devices) {
      const rec = byId.get(d.id) ?? emptyRecord(d);
      const isOn = d.status === DeviceStatus.ON;
      const liveSec =
        isOn && rec.currentSessionStart
          ? msToSeconds(now.getTime() - new Date(rec.currentSessionStart).getTime())
          : 0;
      const todaySec = rec.todayRuntimeSeconds + liveSec;
      const monthSec = rec.monthRuntimeSeconds + liveSec;

      totalToday += todaySec;
      totalMonth += monthSec;
      todayKWh += kWhFor(d.powerDraw, todaySec);
      monthKWh += kWhFor(d.powerDraw, monthSec);

      snapDevices.push({
        deviceId: d.id,
        deviceName: d.name,
        room: ROOM_LABELS[d.room as Room] ?? String(d.room),
        todayRuntimeSeconds: todaySec,
        monthRuntimeSeconds: monthSec,
        totalRuntimeSeconds: rec.totalRuntimeSeconds + liveSec,
        isCurrentlyOn: isOn,
        currentSessionStart: rec.currentSessionStart,
      });
    }

    return {
      devices: snapDevices,
      total: {
        todayRuntimeSeconds: totalToday,
        monthRuntimeSeconds: totalMonth,
        todayKWh: Math.round(todayKWh * 100) / 100,
        monthKWh: Math.round(monthKWh * 100) / 100,
      },
      computedAt: now.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * For every device in `db.json` ensure a `RuntimeRecord` exists. Idempotent:
   * devices that already have a record are left alone. We keep the human
   * label up-to-date in case the device was renamed.
   */
  private async seedMissingRecords(): Promise<void> {
    const devices = await databaseService.getDevices();
    const records = await runtimeHistoryService.getAll();
    const seen = new Set(records.map((r) => r.deviceId));
    let created = 0;
    let updated = 0;
    for (const d of devices) {
      const existing = records.find((r) => r.deviceId === d.id);
      if (!existing) {
        await runtimeHistoryService.upsertRecord(emptyRecord(d));
        created++;
        continue;
      }
      // Keep the cached label fresh.
      const roomLabel = ROOM_LABELS[d.room as Room] ?? String(d.room);
      if (existing.deviceName !== d.name || existing.room !== roomLabel) {
        existing.deviceName = d.name;
        existing.room = roomLabel;
        await runtimeHistoryService.upsertRecord(existing);
        updated++;
      }
    }
    if (created > 0 || updated > 0) {
      logger.info('runtime', `seed: created ${created}, refreshed ${updated} record(s)`);
    }
  }

  /**
   * Add `deltaSec` seconds of runtime to a record. Bumps today, month and
   * total, and appends the running daily / monthly counters to the history
   * maps (NOT the partial delta — see `applyDeltaWithSplit` for that path).
   *
   * No persistence: caller decides when to write.
   */
  private applyDelta(rec: RuntimeRecord, deltaSec: number, now: Date): void {
    rec.todayRuntimeSeconds += deltaSec;
    rec.monthRuntimeSeconds += deltaSec;
    rec.totalRuntimeSeconds += deltaSec;
    const day = ymd(now);
    const month = ym(now);
    rec.dailyHistory[day] = (rec.dailyHistory[day] ?? 0) + deltaSec;
    rec.monthlyHistory[month] = (rec.monthlyHistory[month] ?? 0) + deltaSec;
    rec.lastUpdated = now.toISOString();
  }

  // ---- Tick + rollovers -------------------------------------------------

  /** One iteration of the background loop. Safe to call from a setInterval. */
  async tick(): Promise<void> {
    if (!this.initialized) return;
    const now = new Date();

    // 1. Live accumulation: any device currently ON gets a delta write.
    await this.accumulateLiveSessions(now);

    // 2. Daily rollover, if we've crossed a local midnight.
    if (this.nextDailyResetCheck && now >= this.nextDailyResetCheck) {
      await this.runDailyRollover(now);
      this.nextDailyResetCheck = this.nextMidnight(now);
    }

    // 3. Monthly rollover, if we've crossed a local month boundary.
    if (this.nextMonthlyResetCheck && now >= this.nextMonthlyResetCheck) {
      await this.runMonthlyRollover(now);
      this.nextMonthlyResetCheck = this.nextMonthStart(now);
    }
  }

  /**
   * For every device currently ON, compute the elapsed time since its
   * `currentSessionStart` (or the last tick — we just use sessionStart
   * every time and let `applyDelta` add the full elapsed delta; the
   * absolute values are correct because we only call this once per tick).
   *
   * Persists in one batch via `replaceAll`.
   */
  private async accumulateLiveSessions(now: Date): Promise<void> {
    const devices = await databaseService.getDevices();
    const records = await runtimeHistoryService.getAll();
    const byId = new Map(records.map((r) => [r.deviceId, r]));
    let touched = false;

    for (const d of devices) {
      if (d.status !== DeviceStatus.ON) continue;
      const rec = byId.get(d.id);
      if (!rec || !rec.currentSessionStart) continue;
      const sessionStartMs = new Date(rec.currentSessionStart).getTime();
      const deltaSec = msToSeconds(now.getTime() - sessionStartMs);
      if (deltaSec <= 0) continue;
      this.applyDelta(rec, deltaSec, now);
      // Reset the session anchor so the NEXT tick only measures the new
      // delta, otherwise we'd double-count.
      rec.currentSessionStart = now.toISOString();
      touched = true;
    }
    if (touched) {
      await runtimeHistoryService.replaceAll(records);
    }
  }

  /**
   * Daily rollover — runs at 00:00 local time. For every device:
   *   1. Snapshot `todayRuntimeSeconds` into `dailyHistory[YYYY-MM-DD]`
   *      (using YESTERDAY's date, since the rollover happens at the
   *      boundary).
   *   2. Reset `todayRuntimeSeconds = 0`.
   *   3. If the device is currently ON, split the open session at
   *      midnight: the pre-midnight part stays in the just-snapshotted
   *      `dailyHistory` entry, and a new session starts at 00:00.
   */
  private async runDailyRollover(now: Date): Promise<void> {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = ymd(yesterday);
    const midnight = startOfDay(now);
    const midnightMs = midnight.getTime();

    const records = await runtimeHistoryService.getAll();
    const devices = await databaseService.getDevices();
    const deviceById = new Map(devices.map((d) => [d.id, d]));

    for (const rec of records) {
      // If a session is open and started BEFORE midnight, split it.
      if (rec.currentSessionStart) {
        const startMs = new Date(rec.currentSessionStart).getTime();
        if (startMs < midnightMs) {
          // Pre-midnight portion: counted into yesterday's dailyHistory,
          // todayRuntimeSeconds and monthRuntimeSeconds.
          const preSec = msToSeconds(midnightMs - startMs);
          rec.dailyHistory[yesterdayKey] = (rec.dailyHistory[yesterdayKey] ?? 0) + preSec;
          rec.todayRuntimeSeconds += preSec;
          rec.monthRuntimeSeconds += preSec;
          rec.totalRuntimeSeconds += preSec;
          // Restart the session at 00:00 sharp. Next tick will pick up
          // the post-midnight delta.
          rec.currentSessionStart = midnight.toISOString();
        }
      }
      // Snapshot the day's running counter into the history map and zero it.
      rec.dailyHistory[yesterdayKey] = rec.dailyHistory[yesterdayKey] ?? 0;
      // If the device was ON all day, the live tick already accumulated
      // pre-midnight runtime into `rec.todayRuntimeSeconds` above — that's
      // the value that belongs to "yesterday" from the dashboard's POV
      // and we want it stored under yesterday's key. Replace the slot
      // (don't add) so it doesn't double-count anything that the live
      // tick already pushed after midnight.
      if (rec.todayRuntimeSeconds > 0) {
        rec.dailyHistory[yesterdayKey] = rec.todayRuntimeSeconds;
      }
      rec.todayRuntimeSeconds = 0;
      rec.lastUpdated = now.toISOString();
      void deviceById;
    }
    await runtimeHistoryService.replaceAll(records);
    await runtimeHistoryService.setLastDailyReset(now.toISOString());
    logger.info('runtime', `daily rollover @ ${midnight.toISOString()}`);
  }

  /**
   * Monthly rollover — runs at 00:00 on the first of each month. Same shape
   * as the daily rollover, but operates on `monthRuntimeSeconds` /
   * `monthlyHistory` instead.
   */
  private async runMonthlyRollover(now: Date): Promise<void> {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthKey = ym(lastMonth);
    const monthStart = startOfMonth(now);
    const monthStartMs = monthStart.getTime();

    const records = await runtimeHistoryService.getAll();

    for (const rec of records) {
      if (rec.currentSessionStart) {
        const startMs = new Date(rec.currentSessionStart).getTime();
        if (startMs < monthStartMs) {
          const preSec = msToSeconds(monthStartMs - startMs);
          rec.monthlyHistory[lastMonthKey] = (rec.monthlyHistory[lastMonthKey] ?? 0) + preSec;
          rec.monthRuntimeSeconds += preSec;
          rec.totalRuntimeSeconds += preSec;
          rec.currentSessionStart = monthStart.toISOString();
        }
      }
      if (rec.monthRuntimeSeconds > 0) {
        rec.monthlyHistory[lastMonthKey] = rec.monthRuntimeSeconds;
      }
      rec.monthRuntimeSeconds = 0;
      rec.lastUpdated = now.toISOString();
    }
    await runtimeHistoryService.replaceAll(records);
    await runtimeHistoryService.setLastMonthlyReset(now.toISOString());
    logger.info('runtime', `monthly rollover @ ${monthStart.toISOString()}`);
  }

  // ---- Time helpers ----------------------------------------------------

  /** Next local-time midnight strictly AFTER `now`. */
  private nextMidnight(now: Date): Date {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    return tomorrow;
  }

  /** Next local-time 00:00 on day 1 of the NEXT month. */
  private nextMonthStart(now: Date): Date {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  }
}

export const runtimeService = new RuntimeService();
