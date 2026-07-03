/**
 * usage.api.ts — /api/usage wrapper.
 */
import { http } from './http';
import type { OfficeUsage } from '../types/domain';

export const usageApi = {
  async snapshot(): Promise<OfficeUsage> {
    const r = await http.get<{ success: boolean; data: OfficeUsage }>('/api/usage');
    return r.data.data;
  },
};
