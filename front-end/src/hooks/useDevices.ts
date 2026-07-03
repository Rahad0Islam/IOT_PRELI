/**
 * useDevices — fetches devices, keeps them fresh via socket updates.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { deviceApi } from '../api/device.api';
import { useSocket } from '../contexts/SocketContext';
import type { Device } from '../types/domain';

export const useDevices = () => {
  const query = useQuery<Device[]>({
    queryKey: ['devices'],
    queryFn: deviceApi.list,
  });
  const qc = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onDev = (d: Device) => {
      qc.setQueryData<Device[]>(['devices'], (prev) => {
        if (!prev) return prev;
        return prev.map((x) => (x.id === d.id ? { ...x, ...d } : x));
      });
    };
    socket.on('device_updated', onDev);
    return () => {
      socket.off('device_updated', onDev);
    };
  }, [socket, qc]);

  return query;
};

export const useRooms = () =>
  useQuery({
    queryKey: ['rooms'],
    queryFn: deviceApi.rooms,
  });
