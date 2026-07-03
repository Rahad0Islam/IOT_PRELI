/**
 * OfficeLayout — top-down SVG map of the office.
 * Renders each room with its fans / lights. State is supplied live from props.
 */
import type { Device, RoomUsage } from '../types/domain';
import FanIcon from './FanIcon';
import LightBulbIcon from './LightBulbIcon';

interface Props {
  devices: Device[];
  rooms: RoomUsage[];
}

const ROOMS: { key: string; label: string; x: number; y: number; w: number; h: number }[] = [
  { key: 'Drawing Room', label: 'Drawing Room', x: 30, y: 30, w: 220, h: 160 },
  { key: 'Work Room 1', label: 'Work Room 1', x: 270, y: 30, w: 220, h: 160 },
  { key: 'Work Room 2', label: 'Work Room 2', x: 30, y: 210, w: 460, h: 130 },
];

export default function OfficeLayout({ devices }: Props) {
  const byRoom = devices.reduce<Record<string, Device[]>>((acc, d) => {
    const label =
      d.room === 'drawing' ? 'Drawing Room' : d.room === 'work1' ? 'Work Room 1' : 'Work Room 2';
    acc[label] = acc[label] ?? [];
    acc[label].push(d);
    return acc;
  }, {});

  void ROOMS; // rooms list intentionally kept for future expansion; layout uses dynamic positions below

  return (
    <div className="card overflow-hidden">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Office layout</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <FanIcon on size={16} /> fan
          </span>
          <span className="flex items-center gap-1">
            <LightBulbIcon on size={16} /> light
          </span>
        </div>
      </header>
      <div className="rounded-xl border border-white/10 bg-ink-900/40 overflow-x-auto">
        <svg viewBox="0 0 540 380" className="w-full min-w-[540px] h-[380px]">
          <defs>
            <pattern id="floor" patternUnits="userSpaceOnUse" width="20" height="20">
              <rect width="20" height="20" fill="#0b0f1f" />
              <path d="M0 20 L20 20 M20 0 L20 20" stroke="rgba(255,255,255,.04)" />
            </pattern>
          </defs>
          <rect width="540" height="380" fill="url(#floor)" />

          {ROOMS.map((r) => (
            <g key={r.key}>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx="14"
                fill="rgba(255,255,255,.02)"
                stroke="rgba(255,255,255,.18)"
                strokeWidth="1.2"
              />
              <text
                x={r.x + 12}
                y={r.y + 22}
                fill="rgba(255,255,255,.55)"
                fontSize="13"
                fontFamily="Inter, sans-serif"
              >
                {r.label}
              </text>
              {renderFurniture(r)}
              {renderDevices(r, byRoom[r.key] ?? [])}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

/* Furniture (chairs/tables) — purely decorative. */
function renderFurniture(r: (typeof ROOMS)[number]) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + 10;
  return (
    <g opacity="0.6">
      <rect
        x={cx - 70}
        y={cy - 22}
        width="140"
        height="6"
        rx="3"
        fill="rgba(255,255,255,.18)"
      />
      <rect
        x={cx - 70}
        y={cy + 18}
        width="140"
        height="6"
        rx="3"
        fill="rgba(255,255,255,.18)"
      />
      <circle cx={cx - 50} cy={cy} r="4" fill="rgba(255,255,255,.25)" />
      <circle cx={cx - 25} cy={cy} r="4" fill="rgba(255,255,255,.25)" />
      <circle cx={cx} cy={cy} r="4" fill="rgba(255,255,255,.25)" />
      <circle cx={cx + 25} cy={cy} r="4" fill="rgba(255,255,255,.25)" />
      <circle cx={cx + 50} cy={cy} r="4" fill="rgba(255,255,255,.25)" />
    </g>
  );
}

/* Render the actual devices as little SVG groups inside each room rectangle. */
function renderDevices(r: (typeof ROOMS)[number], devs: Device[]) {
  const fans = devs.filter((d) => d.type === 'fan');
  const lights = devs.filter((d) => d.type === 'light');
  const pad = 24;

  // Fans along the top of the room.
  const fanSlots = fans.length;
  const fanSpacing =
    fanSlots > 1 ? (r.w - pad * 2) / (fanSlots - 1) : 0;
  const fanY = r.y + 36;
  const fanStartX = r.x + pad;

  // Lights along the bottom.
  const lightSlots = lights.length;
  const lightSpacing =
    lightSlots > 1 ? (r.w - pad * 2) / (lightSlots - 1) : 0;
  const lightY = r.y + r.h - 22;
  const lightStartX = r.x + pad;

  return (
    <g>
      {fans.map((f, i) => {
        const x = fanStartX + fanSpacing * i;
        return <DeviceIcon key={f.id} device={f} x={x} y={fanY} />;
      })}
      {lights.map((l, i) => {
        const x = lightStartX + lightSpacing * i;
        return <DeviceIcon key={l.id} device={l} x={x} y={lightY} />;
      })}
    </g>
  );
}

function DeviceIcon({ device, x, y }: { device: Device; x: number; y: number }) {
  const on = device.status === 'ON';
  return (
    <g transform={`translate(${x}, ${y})`}>
      {device.type === 'fan' ? (
        <g style={{ filter: on ? 'drop-shadow(0 0 4px rgba(34,211,238,.7))' : 'none' }}>
          <circle r="11" fill={on ? '#0e3a4a' : '#1a2244'} stroke={on ? '#22d3ee' : '#334155'} />
          <FanIcon on={on} size={18} />
          <text x="0" y="22" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.5)">
            {device.name}
          </text>
        </g>
      ) : (
        <g style={{ filter: on ? 'drop-shadow(0 0 4px rgba(250,204,21,.85))' : 'none' }}>
          <circle r="11" fill={on ? '#3b2a07' : '#1a2244'} stroke={on ? '#f59e0b' : '#334155'} />
          <LightBulbIcon on={on} size={18} />
          <text x="0" y="22" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.5)">
            {device.name}
          </text>
        </g>
      )}
    </g>
  );
}
