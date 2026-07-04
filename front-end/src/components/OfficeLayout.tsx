/**
 * OfficeLayout — top-down SVG floor plan.
 * Each room shows: tables (rectangles), chairs around them, overhead fans,
 * and overhead light bulbs. State is supplied live from props.
 */
import { FaChair, FaTable } from 'react-icons/fa';
import type { Device, RoomUsage } from '../types/domain';
import FanIcon from './FanIcon';
import LightBulbIcon from './LightBulbIcon';

interface Props {
  devices: Device[];
  rooms: RoomUsage[];
}

interface RoomDef {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Number of tables in the room (1 or 2). */
  tables: number;
}

const ROOMS: RoomDef[] = [
  // Drawing Room and Work Room 1 sized like Work Room 2 (wide horizontal layout).
  { key: 'Drawing Room', label: 'Drawing Room', x: 30, y: 30,  w: 460, h: 180, tables: 2 },
  { key: 'Work Room 1',  label: 'Work Room 1',  x: 30, y: 230, w: 460, h: 180, tables: 2 },
  { key: 'Work Room 2',  label: 'Work Room 2',  x: 30, y: 430, w: 460, h: 180, tables: 2 },
];

export default function OfficeLayout({ devices }: Props) {
  const byRoom = devices.reduce<Record<string, Device[]>>((acc, d) => {
    const label =
      d.room === 'drawing' ? 'Drawing Room'
      : d.room === 'work1' ? 'Work Room 1'
      : 'Work Room 2';
    acc[label] = acc[label] ?? [];
    acc[label].push(d);
    return acc;
  }, {});

  return (
    <div className="card overflow-hidden">
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Office layout</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <FaTable className="text-slate-300" /> table
          </span>
          <span className="flex items-center gap-1">
            <FaChair className="text-slate-400" /> chair
          </span>
          <span className="flex items-center gap-1">
            <FanIcon on size={14} /> fan
          </span>
          <span className="flex items-center gap-1">
            <LightBulbIcon on size={14} /> light
          </span>
        </div>
      </header>
      <div className="rounded-xl border border-white/10 bg-ink-900/40 overflow-x-auto">
        <svg viewBox="0 0 540 640" className="w-full min-w-[540px] h-[640px]">
          <defs>
            <pattern id="floor" patternUnits="userSpaceOnUse" width="20" height="20">
              <rect width="20" height="20" fill="#0b0f1f" />
              <path d="M0 20 L20 20 M20 0 L20 20" stroke="rgba(255,255,255,.04)" />
            </pattern>
          </defs>
          <rect width="540" height="640" fill="url(#floor)" />

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
                y={r.y + 20}
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

/* -------- Furnishings -------- */

/** Return the centre coordinates of each table in the room. */
function tableCentres(r: RoomDef): { x: number; y: number }[] {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + 12;
  if (r.tables === 1) return [{ x: cx, y: cy }];
  // Two tables laid out horizontally.
  const off = r.w / 4 - 10;
  return [
    { x: cx - off, y: cy },
    { x: cx + off, y: cy },
  ];
}

/** Render the tables and chairs for one room. */
function renderFurniture(r: RoomDef) {
  const tables = tableCentres(r);

  // Chairs per table: 5 for the single-table rooms, 3 around each of the
  // larger room's two tables (clustered like a meeting space).
  const chairsPerTable = r.tables === 1 ? 5 : 3;

  return (
    <g>
      {/* Table rectangles. */}
      {tables.map((t, i) => (
        <g key={`t-${r.key}-${i}`}>
          <rect
            x={t.x - 38}
            y={t.y - 18}
            width="76"
            height="36"
            rx="6"
            fill="rgba(148,163,184,.10)"
            stroke="rgba(203,213,225,.35)"
            strokeWidth="1"
          />
          <foreignObject x={t.x - 10} y={t.y - 10} width="20" height="20">
            <FaTable
              xmlns="http://www.w3.org/2000/svg"
              size={20}
              color="#cbd5e1"
              style={{ filter: 'drop-shadow(0 0 4px rgba(148,163,184,.4))' }}
            />
          </foreignObject>
        </g>
      ))}

      {/* Chairs around each table. */}
      {tables.map((t, ti) => {
        const positions = chairPositions(t, chairsPerTable);
        return positions.map((p, ci) => (
          <foreignObject
            key={`c-${r.key}-${ti}-${ci}`}
            x={p.x - 7}
            y={p.y - 7}
            width="14"
            height="14"
          >
            <FaChair
              xmlns="http://www.w3.org/2000/svg"
              size={14}
              color="#64748b"
            />
          </foreignObject>
        ));
      })}
    </g>
  );
}

/**
 * Place `n` chairs around a table centre.
 * Arrangement: 1 top, 1 bottom, the rest distributed left/right.
 */
function chairPositions(
  t: { x: number; y: number },
  n: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const topY = t.y - 30;
  const botY = t.y + 30;

  out.push({ x: t.x, y: topY }); // chair above table
  if (n === 2) {
    out.push({ x: t.x, y: botY });
    return out;
  }
  out.push({ x: t.x, y: botY }); // chair below table

  // Remaining chairs spread along the sides.
  const side = n - 2;
  const half = Math.ceil(side / 2);
  const leftCount = side - half;
  const rightCount = half;
  const gap = 22;

  const leftStartY = topY + (botY - topY) / (leftCount + 1);
  const rightStartY = topY + (botY - topY) / (rightCount + 1);

  for (let i = 1; i <= leftCount; i++) {
    out.push({ x: t.x - 46, y: leftStartY + i * ((botY - topY) / (leftCount + 1)) - gap / 2 });
  }
  for (let i = 1; i <= rightCount; i++) {
    out.push({ x: t.x + 46, y: rightStartY + i * ((botY - topY) / (rightCount + 1)) - gap / 2 });
  }

  return out;
}

/* -------- Active devices (overhead fans + lights) -------- */

function renderDevices(r: RoomDef, devs: Device[]) {
  const fans = devs.filter((d) => d.type === 'fan');
  const lights = devs.filter((d) => d.type === 'light');
  const pad = 28;

  // Fans along the top of the room (ceiling row).
  const fanY = r.y + 44;
  const fanSpacing = fans.length > 1 ? (r.w - pad * 2) / (fans.length - 1) : 0;
  const fanStartX = r.x + pad;

  // Lights along the bottom of the room — separate row so fans never overlap.
  const lightY = r.y + r.h - 30;
  const lightSpacing = lights.length > 1 ? (r.w - pad * 2) / (lights.length - 1) : 0;
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
  const isLight = device.type === 'light';
  const radius = isLight ? 16 : 11;
  const iconSize = isLight ? 26 : 18;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {device.type === 'fan' ? (
        <g style={{ filter: on ? 'drop-shadow(0 0 4px rgba(34,211,238,.7))' : 'none' }}>
          <circle r={radius} fill={on ? '#0e3a4a' : '#1a2244'} stroke={on ? '#22d3ee' : '#334155'} />
          <FanIcon on={on} size={iconSize} />
          <text x="0" y={radius + 11} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.5)">
            {device.name}
          </text>
        </g>
      ) : (
        <g style={{ filter: on ? 'drop-shadow(0 0 6px rgba(250,204,21,.85))' : 'none' }}>
          <circle r={radius} fill={on ? '#3b2a07' : '#1a2244'} stroke={on ? '#f59e0b' : '#334155'} />
          <LightBulbIcon on={on} size={iconSize} />
          <text x="0" y={radius + 11} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.5)">
            {device.name}
          </text>
        </g>
      )}
    </g>
  );
}
