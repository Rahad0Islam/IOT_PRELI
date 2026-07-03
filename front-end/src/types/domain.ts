/**
 * Front-end mirrors of backend types. Kept in sync manually (small surface).
 */

export type DeviceType = 'fan' | 'light';
export type DeviceStatus = 'ON' | 'OFF';
export type Room = 'drawing' | 'work1' | 'work2';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  room: Room;
  status: DeviceStatus;
  powerDraw: number;
  lastChanged: string;
  afterHoursAlertSent: boolean;
  runtimeAlertSent: boolean;
}

export type AlertType = 'AFTER_HOURS' | 'CONTINUOUS_RUNTIME';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  deviceId: string;
  deviceName: string;
  room: string;
  triggeredAt: string;
}

export interface RoomUsage {
  room: string;
  powerWatts: number;
  onCount: number;
  totalCount: number;
}

export interface UsageHistoryPoint {
  t: string;
  watts: number;
}

export interface OfficeUsage {
  totalPowerWatts: number;
  estimatedTodayKWh: number;
  estimatedMonthlyKWh: number;
  rooms: RoomUsage[];
  history: UsageHistoryPoint[];
  computedAt: string;
}

export const ROOM_LABELS: Record<Room, string> = {
  drawing: 'Drawing Room',
  work1: 'Work Room 1',
  work2: 'Work Room 2',
};

/** Map device type to a friendly label and Tailwind colour tokens. */
export const DEVICE_META: Record<
  DeviceType,
  { label: string; icon: string; color: string }
> = {
  fan: { label: 'Fan', icon: '🌀', color: 'text-neon-cyan' },
  light: { label: 'Light', icon: '💡', color: 'text-neon-amber' },
};
