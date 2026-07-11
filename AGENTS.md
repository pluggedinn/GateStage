# GateStage — Agent Guide

**LED gate control for FPV whoop races.** Listens to race events from supported race managers (Next available today; FPV Trackside and RotorHazard planned) and drives ESPHome LED gates over the race LAN. Runs on the race director laptop; crew use browsers on the same WiFi.

Canonical entry point for coding agents. UI: `docs/DESIGN.md`. Gate firmware: `docs/ESPHOME.md`.

---

## Quick start

```bash
npm install
npm run dev:mocks    # mock Next + mock ESPHome + GateStage → http://127.0.0.1:8080
```

Test event: `curl -X POST http://127.0.0.1:9401/emit -H 'Content-Type: application/json' -d '{"type":"heat.go"}'`

| Command | Purpose |
|---------|---------|
| `npm run dev:mocks` | Full local stack (recommended) |
| `npm run test:e2e` | Playwright (starts mocks automatically) |
| `npm run lint` | Biome check |
| `npm run build:next` | Next standalone + bundled `gatestage-server.cjs` |
| `npm run build:desktop` | Electron installers → `dist/desktop/` |

More commands and ports: [README.md](./README.md). Desktop packaging: [docs/DESKTOP.md](./docs/DESKTOP.md).

---

## Hard rules

1. **Server is the brain** — race automation lives in `lib/` (Node), not React clients. Browsers are thin Socket.io clients.
2. **Run via `server.ts`** — not plain `next dev` (no Socket.io / RaceBrain / race manager listener otherwise).
3. **ESPHome from server only** — never call ESP32 from the browser (CORS). Use `lib/esphome.ts`.
4. **Gates are discovered** — mDNS (`_esphomelib._tcp`), not manually created. No `POST /api/gates`.
5. **Bind `0.0.0.0`** — crew reach `http://<rd-laptop-ip>:8080`. No auth (trusted LAN).
6. **UI status colors** — semantic tokens in `app/globals.css` only; see [docs/DESIGN.md](./docs/DESIGN.md).

---

## Architecture

```
Race manager  ──WebSocket──▶  server.ts / RaceBrain (lib/)
                                    ├── data/config.json
                                    ├── ESPHome HTTP REST
                                    └── Socket.io → browsers
```

| Layer | Where |
|-------|-------|
| Boot + Socket.io | `server.ts` → `initRaceBrain()` |
| Integration registry | `lib/integrations.ts` |
| Race manager WS client | `lib/race-manager-listener.ts` (Next implemented; others WIP) |
| Event → actions | `lib/gate-engine.ts` |
| ESPHome commands | `lib/esphome.ts` (entity: **`"Gate LEDs"`**) |
| Config (Zod JSON) | `lib/config/` |
| Live UI push | `lib/broadcaster.ts` |
| Gate discovery | `lib/gate-discovery.ts` (rescan ~15s) |

Path alias: `@/*` → project root. Server logic in `lib/`, UI in `app/` + `components/`.

---

## Config

`data/config.json` (override: `GATESTAGE_CONFIG_PATH`). Version **2**: `settings`, `gates[]`, `sequences[]`.

- **Gates:** `{ id, host, isStartGate, enabled, sortOrder }` — from network discovery
- **Sequences** (UI: Routines): event type → ordered steps (`action` or `delay`)
- **Actions:** `effect` | `solid` | `off` | `pilot_color` | `choreography`
- **Targets:** `all` | `start_gate` | `gate_id`
- **Settings:** `raceManagerProvider` (`next` | `trackside` | `rotorhazard`), `nextWsUrl` (Next WebSocket), `rotorHazardUrl` (RotorHazard Socket.io), `defaultBrightnessPercent`

- Default brightness: **5%** (`defaultBrightnessPercent`)

Schemas: `lib/config/schema.ts`, `lib/types.ts`. API routes: `app/api/`.

---

## Race managers

Providers are defined in `lib/integrations.ts`. `raceManagerProvider` in settings selects which integration `RaceManagerListener` uses.

| Provider | Status |
|----------|--------|
| Next | Available (WebSocket via `nextWsUrl`) |
| FPV Trackside | Work in progress (stub) |
| RotorHazard | Available (Socket.io via `rotorHazardUrl`; heat lifecycle + crossings) |

Changing provider or URL reconnects the listener automatically (Settings save).

---

## Race events

`heat.loaded` · `heat.arm_started` · `heat.go` · `heat.finished` · `pilot.crossing` — validated in `lib/types.ts`. Pilot color: `{ r, g, b }` 0–255. `pilot.crossing` debounced 400ms.

Real Next WebSocket schema is **not fully documented** — use `mocks/next-ws-server.ts` for dev.

---

## Dev caveats

- **Health endpoints:** `/api/health` (app), `:9401/health` (mock Next), `:9080/health` (mock ESPHome).
- **Fresh config has no routines.** First boot creates `data/config.json` with `"sequences": []`, so race events won't light gates until routines are configured (Routines UI or `POST /api/sequences/<eventType>/steps`). `e2e/gate-automation.spec.ts` ("heat.go triggers green RGB") fails on a fresh config for this reason — other e2e specs seed their own steps.
- **Lint may exit non-zero on `main`** — pre-existing Biome formatting issues; not a broken setup.

---

## Where to start

| Task | Files |
|------|-------|
| Race manager integrations | `lib/integrations.ts`, `lib/race-manager-listener.ts` |
| Automation logic | `lib/gate-engine.ts` |
| Gate commands | `lib/esphome.ts`, `lib/effects.ts` |
| Config / schema | `lib/config/schema.ts`, `lib/config/store.ts` |
| API endpoint | `app/api/` |
| Live dashboard | `lib/broadcaster.ts`, `hooks/use-race-socket.tsx` |
| Routines UI | `app/routines/` |
| E2E test | `e2e/`, `e2e/helpers/mocks.ts` |
| Gate firmware | `docs/examples/gate.yaml`, [docs/ESPHOME.md](./docs/ESPHOME.md) |
| Visual / UI polish | [docs/DESIGN.md](./docs/DESIGN.md), `.cursor/skills/web-design-engineer/SKILL.md` |
| Desktop packaging / releases | [docs/DESKTOP.md](./docs/DESKTOP.md), `desktop/`, `electron-builder.yml`, `.github/workflows/release-*.yml` |

---

## Not used

Vercel/serverless, Home Assistant, MQTT, client-side ESPHome, database (JSON file only).
