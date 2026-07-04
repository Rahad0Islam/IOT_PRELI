/**
 * SummaryCards — top-of-page KPIs.
 */
import { motion } from 'framer-motion';
import { FaBolt, FaLeaf, FaBell } from 'react-icons/fa';

import type { OfficeUsage, Alert } from '../types/domain';

interface Props {
  usage: OfficeUsage | undefined;
  alerts: Alert[] | undefined;
  deviceCount: number;
  activeCount: number;
}

export default function SummaryCards({ usage, alerts, deviceCount, activeCount }: Props) {
  const watts = usage?.totalPowerWatts ?? 0;
  const kWh = usage?.estimatedTodayKWh ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        icon={<FaBolt />}
        label="Live Power"
        value={`${watts}`}
        suffix="W"
        accent="from-neon-cyan/30 to-neon-cyan/0"
      />
      <StatCard
        icon={<FaLeaf />}
        label="Today"
        value={`${kWh.toFixed(2)}`}
        suffix="kWh"
        accent="from-neon-lime/30 to-neon-lime/0"
      />
      <StatCard
        icon={<FaBell />}
        label="Active / Alerts"
        value={`${activeCount} · ${alerts?.length ?? 0}`}
        suffix={`/ ${deviceCount} devs`}
        accent="from-neon-amber/30 to-neon-amber/0"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden card`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none opacity-40`}
      />
      <div className="relative flex items-start gap-3">
        <div className="text-2xl text-slate-100/80">{icon}</div>
        <div className="flex-1">
          <div className="label">{label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="stat">{value}</span>
            <span className="text-slate-400 text-sm">{suffix}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
