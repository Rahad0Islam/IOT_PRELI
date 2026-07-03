/**
 * PowerHistoryChart — Recharts line chart of the rolling power buffer.
 */
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

import type { UsageHistoryPoint } from '../types/domain';

interface Props {
  data: UsageHistoryPoint[];
}

export default function PowerHistoryChart({ data }: Props) {
  const formatted = data.map((p) => ({
    ...p,
    label: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

  return (
    <div className="card">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Power history</h3>
        <span className="text-xs text-slate-400">Last {data.length} samples</span>
      </header>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted}>
            <CartesianGrid stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,.1)" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="rgba(255,255,255,.1)" unit="W" />
            <Tooltip
              contentStyle={{
                background: 'rgba(11,15,31,.9)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 12,
              }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Line
              type="monotone"
              dataKey="watts"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
