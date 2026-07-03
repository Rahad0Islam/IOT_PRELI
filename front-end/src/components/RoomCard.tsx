/**
 * RoomCard — one room with its 5 devices.
 */
import { Link } from 'react-router-dom';
import type { Device, RoomUsage } from '../types/domain';
import DeviceCard from './DeviceCard';

interface Props {
  label: string;
  devices: Device[];
  usage: RoomUsage | undefined;
}

export default function RoomCard({ label, devices, usage }: Props) {
  const sorted = devices
    .slice()
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type)
    );
  const room = devices[0]?.room ?? 'drawing';

  return (
    <section className="card">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="text-slate-400 text-xs">
            {usage
              ? `${usage.onCount}/${usage.totalCount} on · ${usage.powerWatts} W`
              : 'loading…'}
          </p>
        </div>
        <Link
          to={`/rooms/${room}`}
          className="text-xs text-neon-cyan hover:underline"
        >
          View room →
        </Link>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {sorted.map((d) => (
          <DeviceCard key={d.id} device={d} />
        ))}
      </div>
    </section>
  );
}
