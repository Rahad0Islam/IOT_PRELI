/**
 * useToggleDevice — mutation to flip a device. UI-only concern lives here
 * so the API wrapper stays a pure transport.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deviceApi } from '../api/device.api';

export const useToggleDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { identifier: string; status?: 'ON' | 'OFF' }) =>
      deviceApi.toggle(input.identifier, input.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['usage'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};
