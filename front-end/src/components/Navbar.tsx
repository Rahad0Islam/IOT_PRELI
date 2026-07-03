/**
 * Navbar — top navigation bar with live connection indicator.
 */
import { Link, NavLink } from 'react-router-dom';
import { FaHome, FaBell, FaBuilding, FaInfoCircle } from 'react-icons/fa';
import { MdElectricBolt } from 'react-icons/md';
import ConnectionStatus from './ConnectionStatus';

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
      isActive
        ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'
        : 'text-slate-300 hover:text-white hover:bg-white/5'
    }`;

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-ink-950/70 border-b border-white/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 grid place-items-center rounded-xl bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 border border-white/10 group-hover:scale-105 transition">
            <MdElectricBolt className="text-neon-cyan" size={20} />
          </div>
          <div>
            <div className="font-semibold tracking-tight leading-tight">Office-IoT</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              Real-time monitoring
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            <FaHome /> Dashboard
          </NavLink>
          <NavLink to="/rooms/drawing" className={linkClass}>
            <FaBuilding /> Rooms
          </NavLink>
          <NavLink to="/alerts" className={linkClass}>
            <FaBell /> Alerts
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            <FaInfoCircle /> About
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <ConnectionStatus />
        </div>
      </div>
    </header>
  );
}