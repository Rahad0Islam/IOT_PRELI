/**
 * useAlerts — fetches /api/alerts, merges socket.also().
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { alertApi } from '../api/alert.api';
import { useSocket } from '../contexts/SocketContext';
import type { Alert } from '../types/domain';

export const useAlerts = () => {
  const query = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: alertApi.list,
  });
  const qc = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onAlert = (a: Alert) => {
      qc.setQueryData<Alert[]>(['alerts'], (prev) => (prev ? [a, ...prev] : [a]));
    };
    socket.on('alert_triggered', onAlert);
    return () => {
      socket.off('alert_triggered', onAlert);
    };
  }, [socket, qc]);

  return query;
};

export const useClearAlerts = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertApi.clear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
};
