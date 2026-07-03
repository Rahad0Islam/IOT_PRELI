/**
 * interfaces/office.interface.ts
 *
 * Office-level configuration stored in `db.office`.
 */

export interface OfficeHours {
  /** 24-hour "HH:MM" — when office hours begin. */
  start: string;
  /** 24-hour "HH:MM" — when office hours end. */
  end: string;
}

export interface OfficeConfig {
  officeHours: OfficeHours;
  /** kWh estimated for today. Updated whenever a device toggles. */
  estimatedTodayUsage: number;
}
