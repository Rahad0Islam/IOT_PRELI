/**
 * alert.api.ts — /api/alerts wrapper.
 */
import { http } from './http';
import type { Alert } from '../types/domain';

export const alertApi = {
  async list(): Promise<Alert[]> {
    const r = await http.get<{ success: boolean; data: Alert[] }>('/api/alerts');
    return r.data.data;
  },
  async clear(): Promise<void> {
    await http.delete('/api/alerts');
  },
};
