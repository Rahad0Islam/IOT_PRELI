/**
 * useUsage — fetches /api/usage and merges socket updates.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { usageApi } from '../api/usage.api';
import { useSocket } from '../contexts/SocketContext';
import type { OfficeUsage } from '../types/domain';

export const useUsage = () => {
  const query = useQuery<OfficeUsage>({
    queryKey: ['usage'],
    queryFn: usageApi.snapshot,
    refetchInterval: 15_000,
  });
  const qc = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onUsage = (u: OfficeUsage) => {
      qc.setQueryData(['usage'], u);
    };
    socket.on('usage_updated', onUsage);
    return () => {
      socket.off('usage_updated', onUsage);
    };
  }, [socket, qc]);

  return query;
};
