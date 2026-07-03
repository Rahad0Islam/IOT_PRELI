/**
 * device.api.ts — typed wrappers around /api/devices endpoints.
 */
import { http } from './http';
import type { Device } from '../types/domain';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const deviceApi = {
  async list(): Promise<Device[]> {
    const r = await http.get<ApiEnvelope<Device[]>>('/api/devices');
    return r.data.data;
  },
  async rooms(): Promise<Record<string, Device[]>> {
    const r = await http.get<ApiEnvelope<Record<string, Device[]>>>('/api/rooms');
    return r.data.data;
  },
  async room(room: string): Promise<{ room: string; devices: Device[] }> {
    const r = await http.get<ApiEnvelope<{ room: string; devices: Device[] }>>(
      `/api/rooms/${room}`
    );
    return r.data.data;
  },
  async toggle(identifier: string, status?: 'ON' | 'OFF'): Promise<Device> {
    const r = await http.post<ApiEnvelope<Device>>('/api/device/toggle', {
      identifier,
      status,
    });
    return r.data.data;
  },
};
