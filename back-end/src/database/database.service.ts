/**
 * database/database.service.ts
 *
 * LowDB wrapper. This is the ONLY module that reads/writes db.json — every
 * other module goes through these functions. Swapping LowDB for PostgreSQL
 * later only requires rewriting this file.
 */

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuid } from 'uuid';

import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { buildSeed } from '../utils/seed.js';
import type { DatabaseShape } from '../interfaces/database.interface.js';
import type { Device } from '../interfaces/device.interface.js';
import type { Alert } from '../interfaces/alert.interface.js';

class DatabaseService {
  private db: Low<DatabaseShape> | null = null;

  /** Initialise the LowDB instance and seed empty data on first run. */
  async init(): Promise<void> {
    const adapter = new JSONFile<DatabaseShape>(config.paths.dbFile);
    const db = new Low<DatabaseShape>(adapter, buildSeed());
    await db.read();
    if (!db.data) {
      db.data = buildSeed();
      await db.write();
      logger.info('database', `Seeded db.json at ${config.paths.dbFile}`);
    } else {
      // Defensive migration: ensure missing collections exist after upgrades.
      db.data.devices ??= [];
      db.data.alerts ??= [];
      db.data.office ??= { officeHours: { start: '09:00', end: '17:00' }, estimatedTodayUsage: 0 };
      await db.write();
    }
    this.db = db;
    logger.info('database', `Loaded ${db.data.devices.length} devices, ${db.data.alerts.length} alerts`);
  }

  /** Internal accessor that throws if init wasn't called. */
  private getDb(): Low<DatabaseShape> {
    if (!this.db) throw new Error('DatabaseService used before init()');
    return this.db;
  }

  /* -------- Devices -------- */

  async getDevices(): Promise<Device[]> {
    return this.getDb().data!.devices.slice();
  }

  async getDeviceById(id: string): Promise<Device | null> {
    return this.getDb().data!.devices.find((d) => d.id === id) ?? null;
  }

  async upsertDevice(updated: Device): Promise<Device> {
    const db = this.getDb();
    const list = db.data!.devices;
    const idx = list.findIndex((d) => d.id === updated.id);
    if (idx === -1) list.push(updated);
    else list[idx] = updated;
    await db.write();
    return updated;
  }

  async updateDevice(
    id: string,
    patch: Partial<Omit<Device, 'id'>>
  ): Promise<Device | null> {
    const db = this.getDb();
    const list = db.data!.devices;
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    const existing = list[idx];
    if (!existing) return null;
    const next: Device = { ...existing, ...patch, id };
    list[idx] = next;
    await db.write();
    return next;
  }

  /* -------- Alerts -------- */

  async getAlerts(): Promise<Alert[]> {
    // Newest first.
    return this.getDb()
      .data!.alerts.slice()
      .sort((a, b) => (a.triggeredAt < b.triggeredAt ? 1 : -1));
  }

  async pushAlert(input: Omit<Alert, 'id'>): Promise<Alert> {
    const db = this.getDb();
    const alert: Alert = { id: uuid(), ...input };
    db.data!.alerts.push(alert);
    // Keep history bounded (last 200) so the JSON file stays small.
    if (db.data!.alerts.length > 200) {
      db.data!.alerts = db.data!.alerts.slice(-200);
    }
    await db.write();
    return alert;
  }

  async clearAlerts(): Promise<void> {
    const db = this.getDb();
    db.data!.alerts = [];
    await db.write();
  }

  /* -------- Office -------- */

  async getOfficeConfig() {
    return this.getDb().data!.office;
  }

  async updateOfficeConfig(patch: Partial<DatabaseShape['office']>) {
    const db = this.getDb();
    db.data!.office = { ...db.data!.office, ...patch };
    await db.write();
    return db.data!.office;
  }

  /** LowDB raw access for occasional bulk operations. Use sparingly. */
  async snapshot(): Promise<DatabaseShape> {
    return JSON.parse(JSON.stringify(this.getDb().data)) as DatabaseShape;
  }
}

export const databaseService = new DatabaseService();
