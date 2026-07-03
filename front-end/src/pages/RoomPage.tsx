/**
 * RoomPage — single room detail view.
 */
import { Link, useParams } from 'react-router-dom';
import { useDevices } from '../hooks/useDevices';
import { useUsage } from '../hooks/useUsage';
import { ROOM_LABELS } from '../types/domain';
import { useEffect } from 'react';
import DeviceCard from '../components/DeviceCard';
import FanIcon from '../components/FanIcon';
import LightBulbIcon from '../components/LightBulbIcon';
import RoomUsagePieChart from '../components/RoomUsagePieChart';

const VALID_ROOMS = ['drawing', 'work1', 'work2'] as const;
type RoomKey = (typeof VALID_ROOMS)[number];

export default function RoomPage() {
  const params = useParams();
  const room = (params.room ?? '') as RoomKey;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [room]);

  const devices = useDevices();
  const usage = useUsage();

  const list = (devices.data ?? []).filter((d) => d.room === room);
  const label = ROOM_LABELS[room];

  if (!label) {
    return (
      <div className="card text-center">
        <p className="text-slate-300">Unknown room.</p>
        <Link to="/" className="btn-ghost inline-block mt-3">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const fans = list.filter((d) => d.type === 'fan');
  const lights = list.filter((d) => d.type === 'light');
  const active = list.filter((d) => d.status === 'ON').length;
  const watts = list.filter((d) => d.status === 'ON').reduce((s, d) => s + d.powerDraw, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-200">
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mt-1">{label}</h1>
          <p className="text-slate-400 text-sm">
            {active}/{list.length} devices on · {watts} W draw
          </p>
        </div>
        <div className="flex gap-3">
          {VALID_ROOMS.filter((r) => r !== room).map((r) => (
            <Link
              key={r}
              to={`/rooms/${r}`}
              className="btn-ghost text-xs"
            >
              {ROOM_LABELS[r]}
            </Link>
          ))}
        </div>
      </header>

      <section className="card">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <FanIcon on size={20} /> Fans
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {fans.map((d) => (
            <DeviceCard key={d.id} device={d} />
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <LightBulbIcon on size={20} /> Lights
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {lights.map((d) => (
            <DeviceCard key={d.id} device={d} />
          ))}
        </div>
      </section>

      <RoomUsagePieChart
        rooms={[
          { room, onCount: active, totalCount: list.length, powerWatts: watts },
          {
            room: 'others',
            onCount: 0,
            totalCount: 0,
            powerWatts: (usage.data?.totalPowerWatts ?? 0) - watts,
          },
        ]}
      />
    </div>
  );
}