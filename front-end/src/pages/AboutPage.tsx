/**
 * AboutPage — short project info.
 */
export default function AboutPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">About this build</h1>
        <p className="text-slate-400 text-sm">Local IoT demo dashboard.</p>
      </header>

      <section className="card prose prose-invert max-w-none">
        <p>
          A small, single-tenant office IoT monitor. The backend is the source of
          truth: it stores device state in a LowDB JSON file, runs a
          background simulator that flips devices every 10–15 seconds, scans
          for after-hours and continuous-runtime conditions, and posts alerts
          into a Discord channel. A Discord bot (in-process) answers{' '}
          <code>!status</code>, <code>!room &lt;name&gt;</code>, and{' '}
          <code>!usage</code> using Gemini when available, with a rule-based
          fallback so it never goes silent.
        </p>
        <ul>
          <li>
            <strong>Backend</strong>: Node.js, Express 5, Socket.IO 4, LowDB 7,
            Discord.js v14, Google Generative AI SDK.
          </li>
          <li>
            <strong>Frontend</strong>: React 18, Vite, Tailwind, TanStack Query,
            Recharts, Framer Motion.
          </li>
          <li>
            <strong>Storage</strong>: Single JSON file on disk. Edit{' '}
            <code>LOWDB_FILE</code> in the backend <code>.env</code> to relocate.
          </li>
          <li>
            <strong>No auth</strong>: This is a local demo. Bind to localhost
            or run behind a reverse-proxy with auth if you expose it.
          </li>
        </ul>
        <p>
          See <code>HARDWARE.md</code> for the pin map if you wire this up to
          a real ARDUINO / relay board, and the README at the project root for
          setup and run commands.
        </p>
      </section>
    </div>
  );
}