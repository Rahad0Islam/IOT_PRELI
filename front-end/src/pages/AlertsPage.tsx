/**
 * AlertsPage — full alert log.
 */
import { useAlerts } from '../hooks/useAlerts';
import AlertsPanel from '../components/AlertsPanel';

export default function AlertsPage() {
  const alerts = useAlerts();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
        <p className="text-slate-400 text-sm">
          After-hours usage and continuous runtime events. Each device deduplicates
          so you get at most one alert per active state.
        </p>
      </header>
      <AlertsPanel alerts={alerts.data} />
    </div>
  );
}