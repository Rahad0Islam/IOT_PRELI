/**
 * Footer — small bottom bar.
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-12 py-6 text-center text-slate-500 text-xs">
      <p>
        © {new Date().getFullYear()} <span className="font-semibold text-slate-300">SUST LifeLink</span>. All rights reserved.
      </p>
      <p className="mt-1">
        Lights, Fans & Discord — Real-Time Office Monitoring Dashboard • Powered by React, Node.js, Socket.IO & Discord Bot
      </p>
    </footer>
  );
}