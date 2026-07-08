# GateStage — Agent Guide

**LED gate control for FPV whoop races.** Listens to [Next](https://go-next.co/) race events and drives ESPHome LED gates over the race LAN. Runs on the race director laptop; crew use browsers on the same WiFi.

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

More commands and ports: [README.md](./README.md).

---

## Hard rules

1. **Server is the brain** — race automation lives in `lib/` (Node), not React clients. Browsers are thin Socket.io clients.
2. **Run via `server.ts`** — not plain `next dev` (no Socket.io / RaceBrain / Next listener otherwise).
3. **ESPHome from server only** — never call ESP32 from the browser (CORS). Use `lib/esphome.ts`.
4. **Gates are discovered** — mDNS (`_esphomelib._tcp`), not manually created. No `POST /api/gates`.
5. **Bind `0.0.0.0`** — crew reach `http://<rd-laptop-ip>:8080`. No auth (trusted LAN).
6. **UI status colors** — semantic tokens in `app/globals.css` only; see [docs/DESIGN.md](./docs/DESIGN.md).

---

## Architecture

```
Next RD app  ──WebSocket──▶  server.ts / RaceBrain (lib/)
                                    ├── data/config.json
                                    ├── ESPHome HTTP REST
                                    └── Socket.io → browsers
```

| Layer | Where |
|-------|-------|
| Boot + Socket.io | `server.ts` → `initRaceBrain()` |
| Next WS client | `lib/next-listener.ts` |
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
- Default brightness: **5%** (`defaultBrightnessPercent`)

Schemas: `lib/config/schema.ts`, `lib/types.ts`. API routes: `app/api/`.

---

## Race events

`heat.loaded` · `heat.arm_started` · `heat.go` · `heat.finished` · `pilot.crossing` — validated in `lib/types.ts`. Pilot color: `{ r, g, b }` 0–255. `pilot.crossing` debounced 400ms.

Real Next WebSocket schema is **not fully documented** — use `mocks/next-ws-server.ts` for dev.

---

## Where to start

| Task | Files |
|------|-------|
| Automation logic | `lib/gate-engine.ts` |
| Gate commands | `lib/esphome.ts`, `lib/effects.ts` |
| Config / schema | `lib/config/schema.ts`, `lib/config/store.ts` |
| API endpoint | `app/api/` |
| Live dashboard | `lib/broadcaster.ts`, `hooks/use-race-socket.tsx` |
| Routines UI | `app/routines/` |
| E2E test | `e2e/`, `e2e/helpers/mocks.ts` |
| Gate firmware | `docs/examples/gate.yaml`, [docs/ESPHOME.md](./docs/ESPHOME.md) |
| Visual / UI polish | [docs/DESIGN.md](./docs/DESIGN.md), `.cursor/skills/web-design-engineer/SKILL.md` |

---

## Not used

Vercel/serverless, Home Assistant, MQTT, client-side ESPHome, database (JSON file only).
