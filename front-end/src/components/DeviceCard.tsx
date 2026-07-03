/**
 * DeviceCard — toggleable device tile.
 */
import { motion } from 'framer-motion';
import { useState } from 'react';

import type { Device } from '../types/domain';
import { DEVICE_META } from '../types/domain';
import { useToggleDevice } from '../hooks/useToggleDevice';
import FanIcon from './FanIcon';
import LightBulbIcon from './LightBulbIcon';

interface Props {
  device: Device;
}

export default function DeviceCard({ device }: Props) {
  const toggle = useToggleDevice();
  const [busy, setBusy] = useState(false);
  const on = device.status === 'ON';
  const meta = DEVICE_META[device.type];

  const handleClick = async () => {
    try {
      setBusy(true);
      await toggle.mutateAsync({ identifier: device.name });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      disabled={busy}
      title={`Click to toggle • Last changed ${new Date(device.lastChanged).toLocaleTimeString()}`}
      className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition w-full
        ${
          on
            ? 'border-neon-cyan/40 bg-neon-cyan/5 shadow-[inset_0_0_30px_rgba(34,211,238,.08)]'
            : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 grid place-items-center rounded-xl ${on ? '' : 'opacity-60'}`}>
          {device.type === 'fan' ? (
            <FanIcon on={on} />
          ) : (
            <LightBulbIcon on={on} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{device.name}</div>
          <div className="text-xs text-slate-400">
            {meta.label} · {device.powerDraw} W
          </div>
        </div>
        <div
          className={`pill ${
            on
              ? 'bg-neon-lime/15 text-neon-lime border border-neon-lime/40'
              : 'bg-white/5 text-slate-400 border border-white/10'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              on ? 'bg-neon-lime' : 'bg-slate-400'
            }`}
          />
          {on ? 'ON' : 'OFF'}
        </div>
      </div>
    </motion.button>
  );
}
