# Office-IoT — Real-time Office Monitoring

A single-tenant office IoT monitor. A Node.js backend keeps the source of
truth (15 devices × 3 rooms), a Vite + React dashboard reflects state live
over Socket.IO, a Discord bot replies to `!status` / `!room` / `!usage`
in-channel, and an alert engine flags after-hours and long-running devices.

The architecture is colour-coded in
[`docs/architecture.svg`](docs/architecture.svg) and explained line-by-line
in [`docs/architecture.md`](docs/architecture.md).

```
.
├── back-end/        Node.js + TypeScript + Express + Socket.IO + LowDB + Discord.js + Gemini
├── front-end/       Vite + React + Tailwind + TanStack Query + Recharts
├── docs/
│   ├── architecture.svg
│   └── architecture.md
└── README.md        ← you are here
```

---

## TL;DR

```bash
# 1. Backend
cd back-end
cp .env.example .env             # then fill the secrets below
npm install
npm run dev                      # http://localhost:4000

# 2. Frontend (new terminal)
cd ../front-end
cp .env.example .env             # edit VITE_API_BASE / VITE_SOCKET_URL if needed
npm install
npm run dev                      # http://localhost:5173
```

Open the dashboard at `http://localhost:5173`. Toggle a device in the UI and
you'll see every connected client update immediately — no refresh needed.

---

## Table of contents

1. [Feature list](#feature-list)
2. [Tech stack](#tech-stack)
3. [Project layout](#project-layout)
4. [Setup](#setup)
   - [Prerequisites](#prerequisites)
   - [Backend](#backend)
   - [Discord bot](#discord-bot)
   - [Google Gemini](#google-gemini)
   - [Frontend](#frontend)
5. [Running it](#running-it)
6. [How it works](#how-it-works)
   - [Data model](#data-model)
   - [Live event loop](#live-event-loop)
   - [Alert engine](#alert-engine)
   - [Bot reply loop](#bot-reply-loop)
7. [REST API](#rest-api)
8. [Socket events](#socket-events)
9. [Configuration reference](#configuration-reference)
10. [Troubleshooting](#troubleshooting)
11. [Security notes](#security-notes)

---

## Feature list

- **15 simulated devices** (2 fans + 3 lights × 3 rooms: Drawing Room,
  Work Room 1, Work Room 2).
- **Live dashboard** with per-device toggle, room cards, office top-down
  map, power meter, history chart, and per-room load pie chart.
- **Real-time push** via Socket.IO — `device_updated`, `usage_updated`,
  `runtime_updated`, `alert_triggered`.
- **Persistent runtime tracking** — every device's ON-time is recorded in
  its own LowDB file (`runtime-history.json`) and survives toggles,
  restarts, and day/month rollovers. Power usage (`kWh = W × h / 1000`)
  is computed from these real totals, not a heuristic.
- **Two alert types**, both dedup'd per device:
  - `AFTER_HOURS` — ON outside `OFFICE_START_HOUR` … `OFFICE_END_HOUR`.
  - `CONTINUOUS_RUNTIME` — ON continuously for ≥
    `DEVICE_RUNTIME_ALERT_MINUTES` (default 120 minutes), independent of
    office hours.
- **In-process simulator** — flips 1–2 devices every 10–15s, ~50% ON,
  mirrors what a real ESP32 would do.
- **Discord bot** (discord.js v14) replies to `!status`, `!room <name>`,
  `!usage` in any channel it can read, and **proactively posts alerts** to
  the configured `#office-alerts` channel.
- **Gemini-powered replies** with a deterministic rule-based fallback so
  the bot never goes silent if the LLM is offline, rate-limited, or
  unconfigured.
- **Single-file persistence** via LowDB. Edit `LOWDB_FILE` to relocate.
- **No auth** — local-only by design. Put it behind a reverse proxy with
  auth if you expose it to the internet.

---

## Tech stack

### Backend

| Package            | Version  | Purpose                          |
| ------------------ | -------- | -------------------------------- |
| Node.js            | ≥ 20.x   | ESM runtime                      |
| TypeScript         | 5.x      | Strict typing                    |
| Express            | 5.x      | HTTP                             |
| Socket.IO          | 4.x      | WebSocket fan-out                |
| LowDB              | 7.x      | JSON-file persistence            |
| discord.js         | 14.x     | Bot framework                    |
| @google/generative-ai | latest | Gemini LLM client            |
| express-validator  | 7.x      | Input validation                 |
| uuid               | 11.x     | ID generation                    |
| tsx                | 4.x      | Dev runner / watch               |

### Frontend

| Package        | Purpose                       |
| -------------- | ----------------------------- |
| React 18       | UI                            |
| Vite 5         | Dev server + bundler          |
| TypeScript 5   | Strict typing                 |
| TailwindCSS 3  | Styling                       |
| TanStack Query 5| Server-state + cache         |
| React Router 6 | Routing                       |
| Recharts 2     | Charts                        |
| Framer Motion 11| Animations                  |
| Socket.IO client 4| Live updates               |
| React-Icons 5  | Icon set                      |

---

## Project layout

```
back-end/
├── package.json
├── tsconfig.json
├── .env                       ← your secrets (gitignored)
├── scripts/
│   └── verify-alerts.ts       ← standalone alert-engine test
└── src/
    ├── app.ts                 ← Express factory
    ├── server.ts              ← process entry-point + graceful shutdown
    ├── config/                ← env -> typed config
    ├── database/              ← LowDB (only file that touches db.json)
    ├── socket/                ← Socket.IO wrapper
    ├── middleware/            ← error, 404, async, logger
    ├── modules/
    │   ├── devices/           ← list / toggle / group-by-room
    │   ├── usage/             ← aggregated load + kWh
    │   ├── runtime/           ← persistent per-device runtime engine
    │   ├── alerts/            ← engine + scheduler + routes
    │   ├── office/            ← office-hours config
    │   ├── simulator/         ← background toggle timer
    │   └── discord/           ← bot + Gemini + rule-based fallback
    ├── types/                 ← enums + constants
    ├── interfaces/            ← db-record shapes
    ├── utils/                 ← logger, time helpers, seed
    └── public/index.html      ← landing page at GET /

front-end/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env
└── src/
    ├── main.tsx
    ├── App.tsx                ← Routes
    ├── layouts/DashboardLayout.tsx
    ├── pages/                 ← Dashboard · Room · Alerts · About
    ├── components/            ← DeviceCard · RoomCard · PowerMeter · Charts · etc.
    ├── hooks/                 ← useDevices · useUsage · useAlerts
    ├── contexts/SocketContext.tsx
    ├── api/                   ← axios + per-resource clients
    ├── types/                 ← mirror of backend enums
    ├── styles/index.css       ← tailwind + component classes
    └── utils/config.ts        ← reads VITE_*
```

---

## Setup

### Prerequisites

- **Node.js 20+** (`node -v`).
- **npm 10+** (`npm -v`).
- A **Discord server** you control, plus a Discord application + bot token
  (free).
- *Optional*: a **Google AI Studio** API key for humanised bot replies.

### Backend

```bash
cd back-end
cp .env.example .env
# Open .env and fill in DISCORD_TOKEN at minimum.
npm install
```

`npm run dev` starts the backend in watch mode on port `4000`.

> If `npm run dev` complains about `src/database/db.json` being
> out-of-date, delete it and restart. The simulator seeds 15 fresh devices
> on first boot.

### Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   → **New Application**.
2. **Bot** tab → **Add Bot** → copy the **Token** into
   `back-end/.env` as `DISCORD_TOKEN`. **Treat this token as a password.**
   Never commit `.env`.
3. While you're there, scroll down to **Privileged Gateway Intents** and
   enable **Message Content Intent**. The bot reads `!status` / `!room` /
   `!usage` from message bodies.
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Permissions: `Send Messages`, `Read Message History`, `Read
     Messages/View Channels`.
   - Open the generated URL, invite the bot to your server.
5. Get IDs (Developer Mode: Settings → Advanced → **ON**):
   - Right-click the alert channel (e.g. `#office-alerts`) → **Copy
     Channel ID** → `DISCORD_ALERT_CHANNEL_ID`.
   - Right-click the server icon → **Copy Server ID** →
     `DISCORD_GUILD_IDS`. Multiple servers: comma-separate, no spaces.
     Leave empty for a global listener.
6. Restart the backend. Logs should show `discord ready as <username>`.

### Google Gemini

Optional. Without it the bot still replies using the rule-based fallback.

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   → **Create API key**.
2. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (default
   `gemini-1.5-flash`). Restart the backend.

### Frontend

```bash
cd ../front-end
cp .env.example .env
npm install
```

`.env` content:

```
VITE_API_BASE=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

Change these if your backend isn't on `localhost:4000`.

`npm run dev` boots Vite on `http://localhost:5173`.

---

## Running it

```bash
# Terminal 1
cd back-end && npm run dev

# Terminal 2
cd front-end && npm run dev
```

Verify:

```bash
# Health
curl http://localhost:4000/health        # → {"status":"ok",...}

# Devices
curl http://localhost:4000/api/devices | jq 'length'   # → 15

# Toggle a device
curl -X POST http://localhost:4000/api/devices/toggle \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"Light 1","status":"OFF"}'

# In Discord, type in any channel the bot watches:
# !status     → office summary
# !room drawing
# !usage      → per-room watt share
```

### Other backend scripts

```bash
npm run typecheck      # tsc --noEmit, no output
npm run build          # outputs dist/
npm start              # runs dist/server.js (after build)

# Alert engine harness (no server required):
OFFICE_START_HOUR=3 OFFICE_END_HOUR=4 npx tsx scripts/verify-alerts.ts
```

### Other frontend scripts

```bash
npm run typecheck      # tsc -b --noEmit
npm run build          # tsc -b && vite build → dist/
npm run preview        # static preview of the build
```

---

## How it works

### Data model

| Persisted in `back-end/src/database/db.json` (LowDB):

```ts
{
  devices: [
    {
      id: "uuid",
      name: "Light 1",
      type: "fan" | "light",
      room: "drawing" | "work1" | "work2",
      status: "ON" | "OFF",
      powerDraw: 60 | 15,         // watts
      lastChanged: "ISO-8601",
      afterHoursAlertSent: false, // dedup flag
      runtimeAlertSent: false     // dedup flag
    }
    // … 14 more
  ],
  alerts: [
    {
      id, type, severity, title, message,
      deviceId, deviceName, room,
      triggeredAt
    }
  ],
  office: {
    officeHours: { start: "HH:00", end: "HH:00" },
    estimatedTodayUsage: 0
  }
}
```

`alertTriggered` and `runtimeAlertSent` are reset to `false` whenever a
device flips OFF, so the corresponding alert can re-fire next time.

A **second** LowDB file — `back-end/src/database/runtime-history.json` —
is owned exclusively by the runtime-tracking module. It carries per-device
runtime totals and is never read or written by `database.service.ts`:

```ts
{
  devices: [
    {
      deviceId: "uuid",
      deviceName: "Light 1",
      room: "drawing",
      currentSessionStart: "2025-07-04T10:50:11.351Z" | null,
      todayRuntimeSeconds: 732,
      monthRuntimeSeconds: 732,
      totalRuntimeSeconds: 732,
      dailyHistory:   { "2025-07-04": 732 },
      monthlyHistory: { "2025-07":    732 },
      lastUpdated: "2025-07-04T10:50:11.351Z"
    }
    // … one entry per device id, lazily seeded
  ],
  lastDailyReset:   "2025-07-04T00:00:00.000Z",
  lastMonthlyReset: "2025-07-01T00:00:00.000Z"
}
```

The split is intentional: a corrupt or bloated runtime history can never
break the device/alerts/office-config file the rest of the app depends on.

### Live event loop

```
┌──────────────────┐  every 10–15s    ┌──────────────────┐  updateDevice()  ┌──────────────┐
│ Simulator (or    │ ──────────────► │  Devices Service │ ──────────────► │   Database   │
│  real ESP32)     │                 │                  │                 │   (LowDB)    │
└──────────────────┘                 └─────────┬────────┘                 └──────┬───────┘
                                               │                                 │
                                               │ emit device_updated              │
                                               ▼                                 ▼
                                      ┌──────────────────┐             ┌──────────────────┐
                                      │   Socket.IO      │             │  Alert Engine    │
                                      │                  │             │  every 60s scan  │
                                      └─────────┬────────┘             └─────────┬────────┘
                                                │                                │
                                                │ device_updated / usage_updated  │ alert_triggered
                                                ▼                                ▼
                                       ┌──────────────────────────────────────────────────┐
                                       │   Frontend (React + TanStack Query + Recharts)  │
                                       └──────────────────────────────────────────────────┘
```

A device flip and its consequences:

1. Simulator (or REST toggle) updates the device in LowDB.
2. `DevicesService` updates `lastChanged`, emits `device_updated`.
3. `UsageService` recomputes total / per-room wattage, emits
   `usage_updated`.
4. Frontend `useDevices` / `useUsage` hooks `setQueryData(...)` and React
   re-renders.
5. The alert scheduler (60 s tick) inspects every device:
   - If `!inHours && device.status === ON && !afterHoursAlertSent` →
     push alert, set flag, emit `alert_triggered`, notify Discord.
   - If `now - device.lastChanged >= threshold && !runtimeAlertSent` →
     push alert, set flag, emit `alert_triggered`, notify Discord.

### Alert engine

Two rules. Independent. Both dedup via per-(device, type) flags.

```ts
const inHours = isWithinOfficeHours(start, end, now);
const onMs    = now.getTime() - new Date(device.lastChanged).getTime();

if (!inHours && !device.afterHoursAlertSent) { /* push AFTER_HOURS */ }
if (onMs >= threshold && !device.runtimeAlertSent) { /* push CONTINUOUS_RUNTIME */ }
```

Re-arm: flipping the device OFF in the UI sets both flags back to `false`,
so the same condition will fire a fresh alert next time.

`scripts/verify-alerts.ts` ships with the project and exercises every
scenario from the bug spec:

```
✅ PASS  03:10 — device just ON, inside office hours
✅ PASS  03:50 — device still ON, still inside office hours
✅ PASS  04:01 — device ON, just after office hours
✅ PASS  02:30 — device ON, well before office hours
✅ PASS  05:11 — device ON for >2h, outside office hours
✅ PASS  03:30 — device ON for >2h, INSIDE office hours
```

### Bot reply loop

```
moderator: !status
  └─► DiscordBot.on('messageCreate')
        └─► build a snapshot from the DB
              └─► try geminiService.reply(snapshot)
                    │
                    ├─ success → reply with LLM text
                    └─ any throw → reply with ruleBasedReply(snapshot)
```

Commands:

| Command            | Reply                                                    |
| ------------------ | -------------------------------------------------------- |
| `!status`          | Up-count, devices, current watt draw.                    |
| `!room <name>`     | Filtered view: counts + draw for that room.              |
| `!usage`           | Top consumers, estimated today/month kWh.                |

The fallback is fully deterministic — it formats the same data with `Intl`
and short templates so the bot never goes silent.

---

## REST API

Base URL: `http://localhost:4000`.

All responses follow:

```json
{ "success": true, "data": ..., "error": null }
```

### Health

| Method | Path      | Returns                  |
| ------ | --------- | ------------------------ |
| GET    | `/health` | `{ status: "ok", ... }`  |

### Devices

| Method | Path                       | Body                                  | Returns                          |
| ------ | -------------------------- | ------------------------------------- | -------------------------------- |
| GET    | `/api/devices`             | —                                     | `Device[]` (15)                  |
| GET    | `/api/devices/:id`         | —                                     | `Device`                         |
| POST   | `/api/devices/toggle`      | `{ identifier: string, status?: 'ON'/'OFF' }` | toggled `Device`          |
| GET    | `/api/rooms`               | —                                     | `Record<RoomLabel, Device[]>`   |
| GET    | `/api/rooms/:room`         | —                                     | `Device[]`                       |

`identifier` may be a UUID or a device name (`"Light 1"`, `"Fan 2"`).
If `status` is omitted the toggle flips the current state.

### Usage

| Method | Path           | Returns                                                         |
| ------ | -------------- | --------------------------------------------------------------- |
| GET    | `/api/usage`   | `{ totalPowerWatts, estimatedTodayKWh, estimatedMonthlyKWh, rooms[], history[] }` |

### Alerts

| Method | Path            | Returns        |
| ------ | --------------- | -------------- |
| GET    | `/api/alerts`   | `Alert[]` (newest first) |
| DELETE | `/api/alerts`   | `{ cleared: N }` |

### Office

| Method | Path              | Body                        | Returns |
| ------ | ----------------- | --------------------------- | ------- |
| GET    | `/api/office`     | —                           | current config |
| PUT    | `/api/office/hours` | `{ start: "HH:MM", end: "HH:MM" }` | updated config |

---

## Socket events

The frontend connects to `${VITE_SOCKET_URL}` once on mount and listens for:

| Event            | Payload                  |
| ---------------- | ------------------------ |
| `device_updated` | `Device`                 |
| `usage_updated`  | `OfficeUsage`            |
| `alert_triggered`| `Alert`                  |

Every connected client also receives its own `connect` /
`disconnect` — the navbar shows a "Live"/"Reconnecting…" pill.

---

## Configuration reference

### Backend (`back-end/.env`)

| Var                          | Default | Notes                                       |
| ---------------------------- | ------- | ------------------------------------------- |
| `PORT`                       | `4000`  | HTTP listen port                            |
| `NODE_ENV`                   | `development` |                                          |
| `OFFICE_START_HOUR`          | `9`     | Integer 0..23. Office is `[start, end)`.    |
| `OFFICE_END_HOUR`            | `17`    | Integer 0..23.                             |
| `DEVICE_RUNTIME_ALERT_MINUTES` | `120` | Threshold for `CONTINUOUS_RUNTIME`.        |
| `DISCORD_TOKEN`              | empty   | Bot token. Empty → bot disabled.           |
| `DISCORD_ALERT_CHANNEL_ID`   | empty   | Channel for proactive alert posts.          |
| `DISCORD_GUILD_IDS`          | empty   | CSV of server IDs. Empty → all servers.    |
| `GEMINI_API_KEY`             | empty   | Empty → fallback always wins.              |
| `GEMINI_MODEL`               | `gemini-1.5-flash` |                                       |
| `LOWDB_FILE`                 | `src/database/db.json` | Override to relocate.            |
| `SIMULATOR_ENABLED`          | `true`  | Set `false` to disable background flips.   |
| `SIMULATOR_INTERVAL_MS`      | `12000` | 10–15 s recommended.                       |
| `ALERT_SCAN_INTERVAL_MS`     | `60000` | Lower for testing.                         |
| `ALERT_RUNTIME_MS`           | *(deprecated, see above)* | Use `DEVICE_RUNTIME_ALERT_MINUTES`. |
| `CORS_ORIGINS`               | `*`     | CSV. Lock down in production.              |
| `LOG_LEVEL`                  | `info`  | `debug` / `info` / `warn` / `error`.       |

### Frontend (`front-end/.env`)

| Var               | Default                  | Notes                      |
| ----------------- | ------------------------ | -------------------------- |
| `VITE_API_BASE`   | `http://localhost:4000`  | Axios base URL             |
| `VITE_SOCKET_URL` | `http://localhost:4000`  | Socket.IO endpoint         |

---

## Troubleshooting

**`PORT 4000 is already in use`** → change `PORT` in `back-end/.env`, then
in `front-end/.env` update `VITE_API_BASE` and `VITE_SOCKET_URL` to match.

**Dashboard shows "Reconnecting…" forever** → the Socket.IO endpoint
doesn't match. Check `VITE_SOCKET_URL`. CORS: if your backend has
`CORS_ORIGINS` locked down, make sure the frontend origin is listed.

**`!status` returns nothing in Discord** → bot is offline (check logs for
`discord ready as …`). Confirm `DISCORD_TOKEN`,
`DISCORD_GUILD_IDS`, and that the **Message Content Intent** is enabled
on the Developer Portal.

**Gemini errors spam the logs** → that's expected behaviour. The fallback
always wins; Gemini being unavailable doesn't degrade the bot.

**`afterHoursAlertSent` never resets** → device was toggled ON without
going through `/api/devices/toggle` or the simulator. Reset manually in
`db.json` or toggle the device OFF in the UI.

**Frontend CSS lint warnings about `@tailwind`/`@apply`** → those are
harmless editor warnings before `npm install`. They disappear after
install + `npm run dev`.

---

## Security notes

- **No authentication.** Anything on the same network as the backend can
  toggle devices, read state, and clear alerts. Bind to `127.0.0.1` or
  put it behind a reverse-proxy with auth if you expose it.
- **Token leaking.** Never paste real `DISCORD_TOKEN` /
  `GEMINI_API_KEY` into chat, screenshots, or git history. `.env` is
  gitignored — keep it that way.
- **Webhook URLs / IP allowlists.** Lock `CORS_ORIGINS` to the dashboard
  domain in production.

---