/**
 * scripts/usage-probe.ts
 *
 * Boots the same modules the server uses, drives a small amount of
 * simulated runtime activity, and dumps the EXACT JSON payload that
 * the /api/usage endpoint returns.
 *
 * Usage:
 *   rm -f src/database/runtime-history.json
 *   npx tsx scripts/usage-probe.ts
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const backEndRoot = nodePath.resolve(__dirname, '..');
process.chdir(backEndRoot);

const { DeviceStatus } = await import('../src/types/enums.js');
const { databaseService } = await import('../src/database/database.service.js');
const { runtimeService } = await import('../src/modules/runtime/runtime.service.js');
const { buildOfficeUsage } = await import('../src/modules/usage/usage.service.js');

await databaseService.init();
const devices = await databaseService.getDevices();
console.log(`[usage-probe] loaded ${devices.length} devices`);

// Turn on three devices for ~3s to give us measurable kWh.
const sample = devices.slice(0, 3);
// Use a heavier power draw (500 W) and longer dwell so we cross the 1Wh boundary.
const onDevs = sample.map((d) => ({
  id: d.id,
  name: d.name,
  type: d.type,
  room: d.room,
  powerDraw: 500,
  status: DeviceStatus.ON,
  lastChanged: new Date().toISOString(),
  afterHoursAlertSent: false,
  runtimeAlertSent: false,
}));
for (const od of onDevs) {
  await runtimeService.onDeviceChanged(od);
}
// Let it accumulate 60 seconds — gives 500W × 3 × 60s = 90,000 J ≈ 0.025 kWh.
await new Promise((r) => setTimeout(r, 60_000));

const snap = await runtimeService.snapshot();
const usage = buildOfficeUsage(devices, snap);
console.log('[usage-probe] todayKWh:', usage.estimatedTodayKWh);
console.log('[usage-probe] snap.total.todayKWh:', snap.total.todayKWh);
console.log('[usage-probe] per-room todayKWh:');
for (const r of usage.rooms) {
  console.log(`  - ${r.room.padEnd(15)} today=${r.todayKWh} kWh`);
}

// Smoke check — the wire payload should match what the UI consumes.
const ok =
  typeof usage.estimatedTodayKWh === 'number' &&
  usage.rooms.every((r) => typeof r.todayKWh === 'number' && !('monthKWh' in r)) &&
  !('estimatedMonthlyKWh' in usage);
process.exit(ok ? 0 : 1);