/**
 * DashboardPage — primary overview.
 */
import { useDevices } from '../hooks/useDevices';
import { useUsage } from '../hooks/useUsage';
import { useAlerts } from '../hooks/useAlerts';
import { ROOM_LABELS } from '../types/domain';
import SummaryCards from '../components/SummaryCards';
import PowerMeter from '../components/PowerMeter';
import OfficeLayout from '../components/OfficeLayout';
import RoomCard from '../components/RoomCard';
import PowerHistoryChart from '../components/PowerHistoryChart';
import RoomUsagePieChart from '../components/RoomUsagePieChart';
import AlertsPanel from '../components/AlertsPanel';

export default function DashboardPage() {
  const devices = useDevices();
  const usage = useUsage();
  const alerts = useAlerts();

  const deviceList = devices.data ?? [];
  const active = deviceList.filter((d) => d.status === 'ON').length;
  const rooms = usage.data?.rooms ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Office Overview</h1>
        <p className="text-slate-400 text-sm">
          Live state of all 15 devices across 3 rooms. Updates stream in real-time.
        </p>
      </header>

      <SummaryCards
        usage={usage.data}
        alerts={alerts.data}
        deviceCount={deviceList.length}
        activeCount={active}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PowerMeter
            watts={usage.data?.totalPowerWatts ?? 0}
            todayKWh={usage.data?.estimatedTodayKWh ?? 0}
          />
        </div>
        <AlertsPanel alerts={alerts.data} />
      </div>

      <OfficeLayout devices={deviceList} rooms={rooms} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PowerHistoryChart data={usage.data?.history ?? []} />
        <RoomUsagePieChart rooms={rooms} />
      </div>

      <div className="space-y-6">
        {Object.entries(ROOM_LABELS).map(([key, label]) => (
          <RoomCard
            key={key}
            label={label}
            devices={deviceList.filter((d) => d.room === key)}
            usage={rooms.find((r) => r.room === key)}
          />
        ))}
      </div>
    </div>
  );
}