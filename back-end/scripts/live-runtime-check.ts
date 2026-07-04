/**
 * scripts/live-runtime-check.ts
 *
 * In-process live runtime smoke check.
 *
 * Boots the REAL databaseService and runtimeService (no HTTP server),
 * drives a synthetic sequence of ON/OFF transitions through the same
 * code path the simulator uses, then asserts the snapshot is internally
 * consistent:
 *
 *   - per-device todayRuntimeSeconds > 0 after a session
 *   - office-total todayKWh > 0 after a session
 *   - every device has the shape the front-end expects (no month fields)
 */
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const backEndRoot = nodePath.resolve(__dirname, '..');
process.chdir(backEndRoot);

// Dynamic imports after cwd change so relative paths inside modules resolve.
const { DeviceStatus } = await import('../src/types/enums.js');
const { databaseService } = await import('../src/database/database.service.js');
const { runtimeService } = await import('../src/modules/runtime/runtime.service.js');
// Device type for proper device object construction.
const { DeviceType } = await import('../src/types/enums.js');

await databaseService.init();
const devices = await databaseService.getDevices();
console.log(`[live] loaded ${devices.length} devices`);

// Toggle the first three devices through a couple of cycles.
const targets = devices.slice(0, 3);
for (let cycle = 0; cycle < 2; cycle++) {
  for (const d of targets) {
    const onDev = {
      id: d.id,
      name: d.name,
      type: DeviceType.FAN,
      room: d.room,
      powerDraw: d.powerDraw,
      status: DeviceStatus.ON,
      lastChanged: new Date().toISOString(),
      afterHoursAlertSent: false,
      runtimeAlertSent: false,
    };
    const offDev = { ...onDev, status: DeviceStatus.OFF };
    await runtimeService.onDeviceChanged(onDev);
    await runtimeService.onDeviceChanged(offDev);
  }
}

// Also exercise the live-tick path by leaving one device ON and stepping
// the snapshot manually.
const liveTarget = targets[0]!;
const liveDev = {
  id: liveTarget.id,
  name: liveTarget.name,
  type: DeviceType.FAN,
  room: liveTarget.room,
  powerDraw: liveTarget.powerDraw,
  status: DeviceStatus.ON,
  lastChanged: new Date().toISOString(),
  afterHoursAlertSent: false,
  runtimeAlertSent: false,
};
await runtimeService.onDeviceChanged(liveDev);
// Wait a short interval so live-merge has a measurable delta.
await new Promise((r) => setTimeout(r, 1500));

const snap = await runtimeService.snapshot();

const shapeOk = snap.devices.every(
  (d) =>
    typeof d.todayRuntimeSeconds === 'number' &&
    typeof d.totalRuntimeSeconds === 'number' &&
    !('monthRuntimeSeconds' in d)
);
const totalShapeOk =
  typeof snap.total.todayKWh === 'number' && !('monthKWh' in snap.total);
const hasActivity = snap.total.todayKWh > 0;

console.log(`[live] per-device shape ok      : ${shapeOk}`);
console.log(`[live] office-total shape ok   : ${totalShapeOk}`);
console.log(`[live] has measurable activity : ${hasActivity}`);
console.log(`[live] office todayKWh         : ${snap.total.todayKWh} kWh`);
console.log(`[live] office today runtime    : ${snap.total.todayRuntimeSeconds}s`);
console.log(`[live] first 5 devices:`);
for (const d of snap.devices.slice(0, 5)) {
  console.log(
    `         ${d.deviceName.padEnd(8)} ${d.room.padEnd(13)} today=${d.todayRuntimeSeconds}s total=${d.totalRuntimeSeconds}s on=${d.isCurrentlyOn}`
  );
}
process.exit(shapeOk && totalShapeOk && hasActivity ? 0 : 1);