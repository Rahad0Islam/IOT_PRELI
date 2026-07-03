/**
 * SocketContext — single shared Socket.IO connection.
 * Exposed via useSocket() so any hook/component can subscribe.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { config } from '../utils/config';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(config.socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    s.on('connect', () => {
      // eslint-disable-next-line no-console
      console.info('[socket] connected', s.id);
    });
    s.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.info('[socket] disconnected');
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const value = useMemo(() => socket, [socket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): Socket | null => useContext(SocketContext);
