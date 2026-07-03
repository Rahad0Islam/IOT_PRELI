/**
 * ConnectionStatus — small pulsing dot in the navbar showing socket status.
 */
import { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function ConnectionStatus() {
  const socket = useSocket();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onC = () => setConnected(true);
    const onD = () => setConnected(false);
    socket.on('connect', onC);
    socket.on('disconnect', onD);
    setConnected(socket.connected);
    return () => {
      socket.off('connect', onC);
      socket.off('disconnect', onD);
    };
  }, [socket]);

  return (
    <div className="flex items-center gap-2 pill bg-white/5 border border-white/10">
      <span
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-neon-lime animate-pulse' : 'bg-neon-rose'
        }`}
      />
      <span className="text-slate-300">{connected ? 'Live' : 'Reconnecting…'}</span>
    </div>
  );
}
