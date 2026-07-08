# GateStage — Agent Guide

**LED gate control for FPV whoop races.** GateStage listens to race events from the [Next](https://go-next.co/) race director app and drives ESPHome-controlled LED gates on the course. It runs as a local server on the race director laptop; crew connect via browser on the same race WiFi.

This file is the **canonical entry point for coding agents**. Domain deep-dives live in `docs/` (linked below). Read this before changing code.

---

## Quick start

```bash
npm install
npm run dev:mocks          # mock Next + mock ESPHome fleet + GateStage
```

Open http://127.0.0.1:8080

Emit a test race event:

```bash
curl -X POST http://127.0.0.1:9401/emit \
  -H 'Content-Type: application/json' \
  -d '{"type":"heat.go"}'
```

Run a full heat sequence:

```bash
curl -X POST http://127.0.0.1:9401/sequence \
  -H 'Content-Type: application/json' \
  -d '{"speed":20}'
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | GateStage only (expects mocks or real hardware) |
| `npm run dev:mocks` | **Recommended** — full local stack |
| `npm run build` | Production Next.js build |
| `npm run start` | Production server (`tsx server.ts`) |
| `npm run test:e2e` | Playwright E2E (starts mocks automatically) |
| `npm run lint` | Biome check |
| `npm run format` | Biome format |

---

## This is NOT the Next.js you know

This project uses **Next.js 16** with breaking changes — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. Heed deprecation notices.

---

## What GateStage is (and is not)

| Is | Is not |
|----|--------|
| Local server on the RD laptop | Cloud service or Vercel deployment |
| Event → LED gate automation | Lap timer (that's RotorHazard / Nuclear Hazard) |
| Thin-browser-UI + server brain | Replacement for Next race director |
| ESPHome HTTP over race LAN | Home Assistant, MQTT, or browser → ESP32 calls |

**Race context:** RD laptop runs Next + GateStage on the same machine. ESP32 gates are on the same 5 GHz race WiFi. Server binds **`0.0.0.0`** so crew tablets reach `http://<rd-laptop-ip>:8080`. No auth in v1 — trusted LAN.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for hardware/network topology.

---

## Architecture: server is the brain

**Do not move race automation into React client components.** All orchestration runs in Node.

```
Next RD app  ──WebSocket──▶  GateStage server (race brain)
                                    │
                                    ├──▶ data/config.json (Zod-validated)
                                    ├──▶ ESPHome HTTP REST (gate commands)
                                    └──▶ Socket.io ──▶ browser UIs
```

| Responsibility | Owner |
|----------------|--------|
| WebSocket client → Next | `lib/next-listener.ts` |
| Event → gate actions | `lib/gate-engine.ts` |
| HTTP → ESPHome | `lib/esphome.ts` |
| Config persistence | `lib/config/store.ts` |
| Live UI updates | `lib/broadcaster.ts` → Socket.io |
| Settings / manual / dashboard | Browser (thin Socket.io clients) |

**Must run via `server.ts`** — plain `next dev` does **not** start Socket.io, RaceBrain, or the Next listener.

Entry point: `server.ts` → `initRaceBrain()` → config load, Next WS connect, mDNS gate discovery (every 15s).

---

## Repo layout

```
server.ts                 # HTTP + Next handler + Socket.io + RaceBrain boot
app/                      # Next.js App Router (pages + API routes)
  page.tsx                # Dashboard (live events + gate actions)
  gates/                  # Gate list, reorder, ping/test
  routines/               # Event → sequence step builder
  manual/                 # Per-gate manual override
  settings/               # nextWsUrl, default brightness
  api/                    # REST endpoints (see below)
components/               # UI components (shadcn/ui primitives in ui/)
hooks/use-race-socket.tsx # Socket.io client context
lib/                      # Server + shared logic
  race-brain.ts           # Singleton orchestrator
  next-listener.ts        # WS client → Next
  gate-engine.ts          # Event → sequence steps → ESPHome
  gate-discovery.ts       # mDNS (_esphomelib._tcp)
  esphome.ts              # REST command wrapper
  broadcaster.ts          # Socket.io emit + replay buffer
  config/                 # Zod schema + JSON store
  choreography/           # Multi-gate timed effects (e.g. tunnel)
  effects.ts              # ESPHome effect catalog
  types.ts                # Race events, sequence steps, actions
mocks/                    # Dev mock servers (excluded from tsc)
e2e/                      # Playwright specs
docs/                     # Domain deep-dives
data/config.json          # Runtime config (gitignored)
```

Path alias: `@/*` → project root.

---

## Terminology (code vs old docs)

| Current (use this) | Outdated |
|--------------------|----------|
| `sequences` in config/API | `mappings` |
| `/routines` page | `/mappings` (redirects) |
| Config `version: 2` | version 1 in older docs |
| "Routines" in nav | "Mappings" |

---

## Config model

Single JSON file: `data/config.json` (override with `GATESTAGE_CONFIG_PATH`). Atomic writes (temp + rename). Validated with Zod on load/save.

```ts
{
  version: 2,
  settings: {
    nextWsUrl: "ws://127.0.0.1:9400",
    defaultBrightnessPercent: 5   // 1–100; race strips are bright
  },
  gates: Gate[],
  sequences: EventSequence[]
}
```

**Gates** are **discovered from the network** (mDNS), not manually created. There is no `POST /api/gates`. API supports GET, PATCH metadata, reorder, discover, ping/test. Unreachable gates are removed on rescan.

```ts
Gate = { id, host, isStartGate, enabled, sortOrder }
```

**Sequences** (routines) map race events to ordered steps:

```ts
EventSequence = { id, eventType, enabled, steps: SequenceStep[] }

// Action step
{ kind: "action", target: "all" | "start_gate" | "gate_id", targetGateId?, action }

// Delay step
{ kind: "delay", ms: number }

// Actions: "effect" | "solid" | "off" | "pilot_color" | "choreography"
```

Export/import: `GET/POST /api/config`

---

## Race events

Validated in `lib/types.ts` (`raceEventSchema`):

| Event | When | Typical gate response |
|-------|------|----------------------|
| `heat.loaded` | Heat selected, pilots known | Idle/setup on start gate |
| `heat.arm_started` | Arming sequence begins | Countdown / pulse on start gate |
| `heat.go` | Race starts | Green flash all gates |
| `heat.finished` | Race ends | Red hold / fade off |
| `pilot.crossing` | Start/finish crossing | Flash in pilot color (400ms debounce) |

Pilot color: `{ r, g, b }` integers 0–255.

**Production blocker:** real Next WebSocket URL and payload schema are not fully documented. Dev uses `mocks/next-ws-server.ts`. Confirm with Next team before production.

---

## API routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/health` | GET | Health check |
| `/api/config` | GET, POST | Export/import full config |
| `/api/settings` | GET, PATCH | Read/update settings |
| `/api/gates` | GET | List gates (sorted) |
| `/api/gates/discover` | POST | Trigger mDNS scan |
| `/api/gates/reorder` | POST | `{ orderedIds: string[] }` |
| `/api/gates/[gateId]` | PATCH, POST | Metadata / ping / test |
| `/api/manual/[gateId]` | POST | Send raw ESPHome command |
| `/api/sequences` | GET | List all sequences |
| `/api/sequences/[eventType]` | PATCH | Enable/disable sequence |
| `/api/sequences/[eventType]/steps` | POST | Add step |
| `/api/sequences/[eventType]/steps/[stepId]` | DELETE | Remove step |

API route `params` use async pattern: `{ params: Promise<{ gateId: string }> }`.

Config mutations call `broadcaster.emitConfigUpdated()`.

---

## Socket.io events (server → clients)

| Event | Payload |
|-------|---------|
| `race:event` | Raw Next event received |
| `race:action` | Gate command result |
| `config:updated` | Config changed |
| `gate:health` | `{ gateId, online }` |
| `connection:next` | `{ nextConnected: boolean }` |

New clients receive replay of recent events/actions via `broadcaster.replayRecent()`.

---

## External integrations

### Next race director (WebSocket client)

- Connects to `settings.nextWsUrl` or `NEXT_WS_URL` env
- Reconnects every 3s on disconnect
- Mock control: `POST http://127.0.0.1:9401/emit` or `/sequence`

### ESPHome (HTTP REST only)

- Fixed light entity name: **`"Gate LEDs"`**
- Commands via `lib/esphome.ts` — effect, RGB solid, off
- Brightness: UI uses 1–100%, converted to ESPHome 0–255
- **Never call ESP32 from the browser** — CORS blocks it; server-side only
- Reference firmware: `docs/examples/gate.yaml` (XIAO ESP32-C5, WS2811)
- See [docs/ESPHOME.md](./docs/ESPHOME.md)

### mDNS gate discovery

- Service: `_esphomelib._tcp` via `bonjour-service`
- Gate ID = ESPHome device name (e.g. `gate-start`)
- Background scan every 15s; manual trigger via `POST /api/gates/discover`

---

## Ports

| Service | Port |
|---------|------|
| GateStage | 8080 |
| Mock Next WebSocket | 9400 |
| Mock Next HTTP control | 9401 |
| Mock ESPHome fleet | 9080–9085 (`gate-start` … `gate-finish`) |

---

## Environment variables

All optional with defaults:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | HTTP server port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `NEXT_WS_URL` | `ws://127.0.0.1:9400` | Next WebSocket URL |
| `GATESTAGE_CONFIG_PATH` | `./data/config.json` | Config file path |
| `ESPHOME_MOCK_FLEET` | — | `1` = inject six mock gates |
| `GATESTAGE_DISCOVERY_INTERVAL_MS` | `15000` | mDNS rescan interval |
| `GATESTAGE_DISCOVERY_TIMEOUT_MS` | `5000` | Per-scan timeout |
| `GATESTAGE_ESPHOME_HTTP_PORT` | `80` | Port for discovered gates |

`npm run dev` sets `PORT=8080 NEXT_WS_URL=ws://127.0.0.1:9400 ESPHOME_MOCK_FLEET=1`.

---

## UI conventions

Read [docs/DESIGN.md](./docs/DESIGN.md) before changing layout, colors, or typography.

**Rules that agents must follow:**

- **Semantic status tokens only** — `text-status-ok`, `bg-status-warn`, etc. defined in `app/globals.css`
- **No raw Tailwind palette colors** for status (`emerald-400`, `zinc-500`, …)
- **Arimo** for UI; **mono + tabular-nums** for event types, gate IDs, timestamps
- **shadcn/ui** (`base-nova` style), **next-themes** (system default)
- Every color must encode connection, event, or LED state — no decorative color
- For visual/UI work beyond tokens, read `.cursor/skills/web-design-engineer/SKILL.md`

Event → color mapping lives in `lib/event-status.ts`.

---

## Testing

**Playwright E2E only** — no unit test framework.

```bash
npm run test:e2e
```

Playwright starts three web servers automatically: mock Next, mock ESPHome fleet, GateStage with `GATESTAGE_CONFIG_PATH=./data/e2e-config.json`.

Specs: `e2e/dashboard.spec.ts`, `gate-automation.spec.ts`, `gates-crud.spec.ts`, `tunnel-choreography.spec.ts`

Helpers: `e2e/helpers/mocks.ts` — emit events, reset/read mock ESPHome state.

Use `data-testid` on dashboard connection/event elements for E2E selectors.

---

## Coding conventions

1. **Minimize scope** — smallest correct diff; match surrounding style
2. **Zod everywhere** — config, API bodies, race events
3. **Server logic in `lib/`**, UI in `app/` + `components/`
4. **Lint with Biome** — `npm run lint` before committing
5. **No database** — everything is `data/config.json`
6. **`mocks/` and `e2e/`** are excluded from `tsc`; run via `tsx` directly
7. **Do not use** Vercel/serverless, client-side ESPHome calls, or Home Assistant

---

## Implementation status

| Area | Status |
|------|--------|
| Custom server + Socket.io | Done |
| Gate discovery (mDNS) + CRUD metadata | Done |
| ESPHome REST + manual control | Done |
| Next listener + mock server | Done (mock); real Next API TBD |
| Sequences / routines automation | Done |
| Dashboard live console | Done |
| Config export/import | Done |
| Playwright E2E | Done |
| Gate health UI polish | Partial |
| Electron distribution | Planned (`output: "standalone"` ready) |

---

## Open questions

1. **Next WebSocket API** — URL, auth, exact payload schema (use mocks until confirmed)
2. **Settings `nextWsUrl` change** — may require server restart to reconnect listener
3. **Which gate on `pilot.crossing`** — currently configurable via routine target
4. **Electron packaging** — Mac .dmg / Windows .exe (future)

---

## Further reading

| Doc | When to read |
|-----|--------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Hardware, race WiFi, Nuclear Hazard, data flow diagrams |
| [docs/DESIGN.md](./docs/DESIGN.md) | UI tokens, typography, anti-patterns |
| [docs/ESPHOME.md](./docs/ESPHOME.md) | Gate firmware, wiring, REST endpoints |
| [README.md](./README.md) | Human-facing quick start |

---

## Key files cheat sheet

| Task | Start here |
|------|------------|
| Add race event type | `lib/types.ts` → `gate-engine.ts` → routines UI |
| Change gate command | `lib/esphome.ts` |
| Change automation logic | `lib/gate-engine.ts` |
| Change config shape | `lib/config/schema.ts` + `store.ts` + migration |
| Add API endpoint | `app/api/` |
| Live UI updates | `lib/broadcaster.ts` + `hooks/use-race-socket.tsx` |
| Add ESPHome effect | `lib/effects.ts` + `docs/examples/gate.yaml` |
| E2E test | `e2e/` + `e2e/helpers/mocks.ts` |
