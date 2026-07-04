/**
 * PowerMeter — large circular gauge showing total office draw.
 */
import { motion } from 'framer-motion';
import { FaBolt } from 'react-icons/fa';
import AnimatedNumber from './AnimatedNumber';

const MAX_WATTS = 1500; // visualisation cap.

export default function PowerMeter({
  watts,
  todayKWh = 0,
}: {
  watts: number;
  todayKWh?: number;
}) {
  const pct = Math.min(100, Math.round((watts / MAX_WATTS) * 100));
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="card flex items-center gap-6">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle cx="100" cy="100" r={radius} stroke="rgba(255,255,255,.08)" strokeWidth="14" fill="none" />
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            stroke="url(#power-grad)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="power-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-slate-400 text-xs uppercase tracking-widest flex items-center gap-1">
            <FaBolt /> Live Power
          </div>
          <div className="text-5xl font-bold mt-1">
            <AnimatedNumber value={Math.round(watts)} />
          </div>
          <div className="text-slate-400 text-sm">Watts</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3">
        <Stat label="Today" value={todayKWh.toFixed(2)} suffix="kWh" />
        <Stat label="Cap" value={`${MAX_WATTS}`} suffix="W" />
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold">{value}</span>
        <span className="text-slate-400 text-xs">{suffix}</span>
      </div>
    </div>
  );
}
