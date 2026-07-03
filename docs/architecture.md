# Architecture &amp; Workflow

Single-page overview of how the pieces fit together.
The source diagram is `architecture.svg` in this folder.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          USERS &amp; EXTERNAL SYSTEMS                       │
│   Operator  ─►  Dashboard  |  Moderator  ─►  Discord  |  ESP32 / Sim.    │
└───────────────────────────────────────────────────────────────────────────┘
            │                   ▲                    │             │
            │ HTTP REST         │ WebSocket          │ state       │
            ▼                   │                    ▼             ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       BACKEND (single source of truth)                    │
│                                                                           │
│   REST API ──► Services ──► DatabaseService (LowDB) ──► db.json           │
│              │                ▲          ▲                                  │
│   Socket.IO  │                │          │                                  │
│              ▼                │          │                                  │
│        emit events         Simulator   Alert Engine                       │
│              ▲              loop          │                                  │
│              │                          │  │                               │
│              │                          ▼  ▼                              │
│              │                    DB   Discord channel                    │
│              │                          ▲                                  │
│   Discord Bot ◄──────────────────────────┤  Gemini (optional) + fallback    │
└───────────────────────────────────────────────────────────────────────────┘
            │                                     │
            ▼                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                          │
│                                                                           │
│   Axios ──► Pages ──► Hooks ──► TanStack Query ◄─── Socket.IO Client     │
│                                       (cache)                              │
└───────────────────────────────────────────────────────────────────────────┘
```

## Read order of the live event loop

1. **Simulator** (or the real ESP32) writes a new device status into the DB.
2. **DatabaseService** persists it.
3. **Devices/Usage services** emit `device_updated` / `usage_updated` over **Socket.IO**.
4. **Frontend** receives the event, calls `setQueryData` so React re-renders instantly.
5. **Alert Engine** (60 s timer) inspects every device:
   - `AFTER_HOURS` — fires immediately if ON outside office hours.
   - `CONTINUOUS_RUNTIME` — fires when ON continuously past 2 h.
   - **Dedup**: each device has `afterHoursAlertSent` / `runtimeAlertSent` flags, reset on OFF.
6. When an alert fires:
   - It's pushed to the DB (capped at 200 entries).
   - `alert_triggered` is broadcast via Socket.IO.
   - The **Discord bot** posts the same alert into `#office-alerts`.

## Read order of the bot reply loop

1. Moderator types `!status` / `!room &lt;name&gt;</code> / <code>!usage` in any channel the bot watches.
2. **Discord bot** builds a snapshot from the DB.
3. **Gemini service** is called first; on success reply comes from there.
4. On any failure (no key, network, rate limit), the **rule-based fallback** returns a deterministic summary. The bot never goes silent.

## Why a single backend?

Everything in this system (DB, simulator, alert engine, Discord bot, REST + WS) is one Node process. That means:

- One source of truth, no race conditions.
- Bot restarts when the backend restarts — no separate deploy.
- Adding a real ESP32 later is just replacing the simulator's `updateDevice` call with an inbound `POST /api/devices/:id/toggle`.

See `architecture.svg` for the full colour-coded diagram.
