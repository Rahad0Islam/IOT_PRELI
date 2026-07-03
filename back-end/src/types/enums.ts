/**
 * types/enums.ts
 *
 * All shared string enums. Using string enums (not numeric) keeps
 * JSON serialisation human-readable and debugging trivial.
 */

/** Logical device type — drives both UI rendering and default power draw. */
export enum DeviceType {
  FAN = 'fan',
  LIGHT = 'light',
}

/** On/off power state. String union for serialisation clarity. */
export enum DeviceStatus {
  ON = 'ON',
  OFF = 'OFF',
}

/** The three rooms in the office. Identifiers are lowercase tokens suitable for URLs / API. */
export enum Room {
  DRAWING = 'drawing',
  WORK_1 = 'work1',
  WORK_2 = 'work2',
}

/** Human-readable label per room (for UI / Discord). */
export const ROOM_LABELS: Record<Room, string> = {
  [Room.DRAWING]: 'Drawing Room',
  [Room.WORK_1]: 'Work Room 1',
  [Room.WORK_2]: 'Work Room 2',
};

/** Alert categories. See SPEC for rules. */
export enum AlertType {
  AFTER_HOURS = 'AFTER_HOURS',
  CONTINUOUS_RUNTIME = 'CONTINUOUS_RUNTIME',
}

/** Logical severity bucket — used for sorting and Discord icon choices. */
export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/** Names of the socket events the server emits. Centralising these prevents stringly-typed bugs. */
export enum SocketEvent {
  DEVICE_UPDATED = 'device_updated',
  USAGE_UPDATED = 'usage_updated',
  ALERT_TRIGGERED = 'alert_triggered',
}

/** Default power draw in watts for each device type when ON. */
export const POWER_DRAW_WATTS: Record<DeviceType, number> = {
  [DeviceType.FAN]: 60,
  [DeviceType.LIGHT]: 15,
};
