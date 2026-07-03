/**
 * AlertsPanel — list of the most recent alerts.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { FaBell, FaTrash } from 'react-icons/fa';

import type { Alert } from '../types/domain';
import { useClearAlerts } from '../hooks/useAlerts';

interface Props {
  alerts: Alert[] | undefined;
}

export default function AlertsPanel({ alerts }: Props) {
  const clear = useClearAlerts();
  const list = alerts ?? [];

  return (
    <section className="card">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FaBell className="text-neon-amber" /> Active alerts
        </h3>
        <button
          onClick={() => clear.mutate()}
          disabled={clear.isPending || list.length === 0}
          className="btn-ghost text-xs disabled:opacity-40"
        >
          <FaTrash /> Clear all
        </button>
      </header>

      {list.length === 0 ? (
        <p className="text-slate-400 text-sm">All clear. No active alerts. 🌿</p>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
          <AnimatePresence initial={false}>
            {list.slice(0, 30).map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-3 rounded-xl border ${
                  a.type === 'AFTER_HOURS'
                    ? 'border-neon-rose/40 bg-neon-rose/5'
                    : 'border-neon-amber/40 bg-neon-amber/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm">{a.title}</strong>
                  <span className="text-xs text-slate-400">
                    {new Date(a.triggeredAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">{a.message}</p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
