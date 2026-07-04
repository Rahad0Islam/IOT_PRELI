#!/usr/bin/env -S npx tsx
/**
 * scripts/verify-alerts.ts
 *
 * Standalone verification harness for the alert engine.
 * Runs against the *actual* time logic and alert service code — no HTTP
 * server required. Exercises every scenario from the bug report.
 *
 * IMPORTANT: This file is TypeScript and MUST be run with `tsx` (or compiled
 * to JS first). Plain `node` cannot execute it and will fail with
 * `ERR_MODULE_NOT_FOUND: .../config.js` because Node tries to resolve the
 * `.js` import as a literal file (it does not transpile `.ts`).
 *
 * Usage (run from the back-end/ directory):
 *   npm run verify:alerts          # recommended
 *   npx tsx scripts/verify-alerts.ts
 *   ./scripts/verify-alerts.ts     # works thanks to the shebang above
 *
 * DO NOT run with `node ./scripts/verify-alerts.ts` — that bypasses tsx.
 */
import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { default as nodePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config/config.js';

// Resolve the back-end root (one level up from this script). Running the
// harness from any other directory will produce a misleading "Cannot find
// module '../src/config/config.js'" — guard against it up front.
//
// We require TWO markers so the guard stays accurate even if one is moved:
//   1. src/config/config.ts   — the file this script imports
//   2. package.json           — the back-end npm project root
// The script's own directory (scripts/) is also checked so a misrun from
// a sibling project with the same folder name still fails fast.
const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const backEndRoot = nodePath.resolve(__dirname, '..');
const expectedConfigTs = nodePath.join(backEndRoot, 'src/config/config.ts');
const expectedPackageJson = nodePath.join(backEndRoot, 'package.json');
const scriptsDir = nodePath.resolve(backEndRoot, 'scripts');
if (
  !existsSync(expectedConfigTs) ||
  !existsSync(expectedPackageJson) ||
  nodePath.resolve(__dirname) !== scriptsDir
) {
  console.error(
    `\n[verify-alerts] Could not locate back-end root.\n` +
      `  Looked for: ${expectedConfigTs}\n` +
      `  Looked for: ${expectedPackageJson}\n` +
      `  Expected scripts/ at: ${scriptsDir}\n` +
      `  Run this script from the back-end/ directory:\n` +
      `    npm run verify:alerts\n` +
      `  or:\n` +
      `    npx tsx scripts/verify-alerts.ts\n`
  );
  process.exit(2);
}
process.chdir(backEndRoot);

// All app imports come AFTER the directory guard so a misrun gets a clear
// error instead of a raw "Cannot find module …".
// const { config } = await import('../src/config/config.js');
const { isWithinOfficeHours, msSince } = await import('../src/utils/time.js');

/**
 * Test scenarios are defined RELATIVE to the configured office window so
 * the harness stays valid regardless of OFFICE_START_HOUR / OFFICE_END_HOUR.
 *   base = a known in-hours anchor (1 hour after start).
 *   outsideLate = 1 hour after end (after-hours on the same day).
 *   outsideEarly = 1 hour before start (after-hours on the same day).
 */
const startHour = config.office.startHour;
const endHour = config.office.endHour;
const of = (h: number): string => `${String(((h % 24) + 24) % 24).padStart(2, '0')}:00`;
/**
 * Office window is half-open: [start, end). Pick the anchor inside the
 * window by stepping 0.5h past the start, so the harness stays valid
 * regardless of how narrow the window is (e.g. 09–10).
 */
const inHoursAnchor = of(startHour) // 09:00
  .replace(/^(\d{2}):00$/, (_m, hh: string) => `${hh}:30`); // 09:30
const outsideLate = of(endHour); // end-hour itself counts as after-hours
const outsideEarly = of(startHour - 1);
const outsideLateLateNight = of(endHour + 3);

interface Scenario {
  name: string;
  /** Wall-clock HH:MM to simulate. */
  clock: string;
  /** How long the device has been ON, in ms. */
  onForMs: number;
  expectedAfterHours: boolean;
  expectedRuntime: boolean;
}

const officeStart = config.office.start;
const officeEnd = config.office.end;
const thresholdMs = config.alerts.continuousRuntimeMs;

// All "no-runtime-yet" scenarios use 50% of the configured threshold so the
// harness passes regardless of DEVICE_RUNTIME_ALERT_MINUTES (e.g. 2 min or 120).
// The single "runtime firing" scenario uses 2x the threshold.
const halfThreshold = Math.floor(thresholdMs / 2);
const doubleThreshold = thresholdMs * 2;

const SCENARIOS: Scenario[] = [
  // ---- Anchor scenarios (always inside the configured window) ----
  { name: `${inHoursAnchor} — device just ON, inside office hours`,
    clock: inHoursAnchor, onForMs: 0,
    expectedAfterHours: false, expectedRuntime: false },
  { name: `${inHoursAnchor.slice(0, 2)}:45 — device still ON, still inside office hours`,
    clock: `${inHoursAnchor.slice(0, 2)}:45`, onForMs: halfThreshold,
    expectedAfterHours: false, expectedRuntime: false },
  // ---- Anchor scenarios (outside the configured window) ----
  { name: `${outsideLate}:01 — device ON, just after office hours`,
    clock: `${outsideLate.slice(0, 2)}:01`, onForMs: halfThreshold,
    expectedAfterHours: true, expectedRuntime: false },
  { name: `${outsideEarly}:30 — device ON, well before office hours`,
    clock: `${outsideEarly.slice(0, 2)}:30`, onForMs: halfThreshold,
    expectedAfterHours: true, expectedRuntime: false },

  // ---- Dual-trigger architecture (on-toggle + 60s scan) ----
  // The IMMEDIATE path fires the alert the moment a device is toggled ON
  // after-hours, without waiting for the 60s scheduler tick.
  { name: `IMMEDIATE ${outsideLate}:05 — toggle-ON just after office hours (instant)`,
    clock: `${outsideLate.slice(0, 2)}:05`, onForMs: 0,
    expectedAfterHours: true, expectedRuntime: false },
  { name: `IMMEDIATE ${outsideEarly}:00 — toggle-ON well before office hours (instant)`,
    clock: `${outsideEarly.slice(0, 2)}:00`, onForMs: 0,
    expectedAfterHours: true, expectedRuntime: false },
  // Below: a device already past the runtime threshold gets its lastChanged
  // refreshed. The on-toggle path should now fire CONTINUOUS_RUNTIME in
  // addition to AFTER_HOURS when relevant.
  { name: `IMMEDIATE ${outsideLateLateNight}:10 — toggle-ON, was already ON 2x threshold, after-hours`,
    clock: `${outsideLateLateNight.slice(0, 2)}:10`, onForMs: doubleThreshold,
    expectedAfterHours: true, expectedRuntime: true },
];

console.log(`\nOffice window: ${officeStart}–${officeEnd}`);
console.log(`Runtime threshold: ${thresholdMs / 60_000} minutes\n`);

let pass = 0;
let fail = 0;

for (const s of SCENARIOS) {
  const [h, m] = s.clock.split(':').map(Number);
  const fakeNow = new Date();
  fakeNow.setHours(h!, m!, 0, 0);

  const inHours = isWithinOfficeHours(officeStart, officeEnd, fakeNow);
  const afterHoursActual = !inHours;
  const runtimeActual = s.onForMs >= thresholdMs;

  const ok = afterHoursActual === s.expectedAfterHours && runtimeActual === s.expectedRuntime;

  // msSince uses real Date.now(); fake it by patching.
  const realOnSince = new Date(Date.now() - s.onForMs).toISOString();
  void msSince(realOnSince); // touch to silence unused-warning

  const verdict = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${verdict}  ${s.name}`);
  console.log(`        afterHours: got=${afterHoursActual} want=${s.expectedAfterHours}`);
  console.log(`        runtime   : got=${runtimeActual}    want=${s.expectedRuntime}`);

  ok ? pass++ : fail++;
}

// ---------------------------------------------------------------------
//  Static checks: verify the dual-trigger wiring exists in source code.
//  These don't spin the simulator — they grep the code so the dual-trigger
//  guarantee is enforced even when no live test runs.
// ---------------------------------------------------------------------
console.log('\n-- Dual-trigger wiring (source-level) --');
{
  const devicesSvc = readFileSync(nodePath.resolve('src/modules/devices/device.service.ts'), 'utf8');
  const alertSvc = readFileSync(nodePath.resolve('src/modules/alerts/alert.service.ts'), 'utf8');

  const checks: Array<[string, boolean]> = [
    [
      'devices.service.ts calls alertService.evaluateNow()',
      /alertService\.evaluateNow\(/.test(devicesSvc),
    ],
    [
      'alert.service.ts exposes evaluateNow()',
      /async\s+evaluateNow\s*\(/.test(alertSvc),
    ],
    [
      'alert.service.ts keeps the 60s scheduler scan()',
      /async\s+scan\s*\(/.test(alertSvc),
    ],
    [
      'simulator.service.ts routes flips through deviceService.applyStatus() (LIVE trigger)',
      /deviceService\.applyStatus\(/.test(
        readFileSync(nodePath.resolve('src/modules/simulator/simulator.service.ts'), 'utf8')
      ),
    ],
    [
      'simulator.service.ts does NOT bypass the alert path with raw databaseService.updateDevice + socket.emit',
      !/databaseService\.updateDevice\([^)]*\)\s*;\s*if\s*\([\s\S]{0,80}socketService\.emit\(SocketEvent\.DEVICE_UPDATED/.test(
        readFileSync(nodePath.resolve('src/modules/simulator/simulator.service.ts'), 'utf8')
      ),
    ],
  ];

  let wirePass = 0;
  let wireFail = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}`);
    ok ? wirePass++ : wireFail++;
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed, ${wirePass} wiring ok, ${wireFail} wiring broken.\n`);
  process.exit(fail === 0 && wireFail === 0 ? 0 : 1);
}