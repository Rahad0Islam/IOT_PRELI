/**
 * RoomUsagePieChart — Recharts pie showing per-room watt share.
 */
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RoomUsage } from '../types/domain';

interface Props {
  rooms: RoomUsage[];
}

const COLOURS = ['#22d3ee', '#8b5cf6', '#a3e635'];

export default function RoomUsagePieChart({ rooms }: Props) {
  const data = rooms.map((r) => ({ name: r.room, value: r.powerWatts }));
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="card">
      <header className="mb-2">
        <h3 className="text-lg font-semibold">Per-room load</h3>
        <p className="text-xs text-slate-400">Share of office draw</p>
      </header>
      <div className="h-64 flex items-center">
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(11,15,31,.9)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2">
          {rooms.map((r, i) => (
            <li key={r.room} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: COLOURS[i % COLOURS.length] }}
                />
                {r.room}
              </span>
              <span className="text-slate-400">
                {r.powerWatts} W · {total > 0 ? Math.round((r.powerWatts / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
