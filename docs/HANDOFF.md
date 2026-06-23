# GateStage — Agent Handoff

**Read this first.** This document captures everything decided in project planning so another agent (or developer) can implement GateStage without prior chat context.

---

## Product summary

**GateStage** is a local server application for FPV whoop race events. It:

1. Listens to race events from the **Next** race director desktop app ([go-next.co](https://go-next.co/))
2. Maps those events to LED gate behaviors
3. Sends commands to **ESPHome** devices (ESP32-C5 + 12V LED strips) over the race LAN
4. Serves a **web UI** for configuration, manual control, and a live event console
5. Supports **multiple browser clients** on the same WiFi (crew tablets, etc.)

**Tagline:** LED gate control for FPV races.

---

## What GateStage is NOT

- Not a lap timer (that's **Nuclear Hazard / RotorHazard** — RSSI only, feeds Next)
- Not a replacement for **Next** (Next remains the race director app)
- Not dependent on Home Assistant
- Not a cloud service — runs locally on the race director laptop

---

## Race environment (must understand)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full detail. Short version:

| Piece | Location | Role |
|-------|----------|------|
| Nuclear Hazard (Pi 4) | At track | 5 GHz AP (ch 36) + RotorHazard timing |
| USB WiFi + antenna | Plugged into Pi | Internet uplink (tablet hotspot or venue WiFi) |
| RD laptop | Race WiFi | Next app + **GateStage server** |
| ESP32 gates | Race WiFi | LED strips |
| Whoops | Air | VTX on Raceband R1–R8, **not on WiFi** |

GateStage server must bind **`0.0.0.0`** (not only `127.0.0.1`) so crew devices on race WiFi can reach the UI.

---

## Architecture decision: server is the brain

**Final decision (do not revert to client-only design):**

| Responsibility | Owner |
|----------------|--------|
| WebSocket client → Next RD app | **GateStage server** (Node) |
| Event → action mapping | **GateStage server** |
| HTTP → ESPHome gates | **GateStage server** (avoids browser CORS) |
| Config persistence | **GateStage server** (Zod-validated JSON file) |
| Broadcast live events to UIs | **GateStage server** (Socket.io) |
| Settings / manual / live console UI | **Browser clients** (thin) |

**Why:** RD laptop is the main brain; browsers are windows. Other devices log into the same server to see settings and events. If logic lived in React client components, closing a tab would stop gate reactions and multi-device sync would break.

**Rejected alternatives:**

- Client components connecting directly to Next WebSocket — no multi-device, tab-dependent
- Home Assistant in the loop — extra latency and failure point
- MQTT for v1 — unnecessary for ~4–8 gates
- Python/FastAPI split — user prefers all Next.js; ESPHome REST from Node is sufficient for v1

---

## Tech stack (implement this)

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15+**, App Router, **TypeScript** |
| Custom server | **`server.ts`** — Next.js + **Socket.io** on one port |
| Next event input | **`ws`** package — WebSocket **client** to Next RD (localhost) |
| Gate output | **HTTP REST** to ESPHome `web_server` via `fetch` |
| Config | **Zod-validated JSON** (`data/config.json`) |
| Real-time UI | **Socket.io** (server → all browsers) |
| Auth | **None in v1** — trusted race LAN; no login |
| UI | **Tailwind + shadcn/ui** |
| Validation | **Zod** (event payloads, API bodies) |
| Future distribution | **Electron** + `output: 'standalone'` + **electron-builder** (Mac .dmg, Windows .exe) |

### Do NOT use

- Vercel / serverless deployment — needs persistent local server
- Client-side-only ESPHome calls — CORS will block browser → ESP32

---

## Next RD events to handle

These are the events GateStage must consume (exact payload schema **TBD** — confirm with Next team or inspect locally):

| Event | When | Expected use |
|-------|------|----------------|
| `heat.loaded` | Heat/group selected, frequencies assigned, pilots known | Idle/setup; show pilot colors on start gate; contains pilot info + colors |
| `heat.arm_started` | RD presses Start; arming sequence begins | Countdown / chase animation on start gate |
| `heat.go` | Start tone; race clock starts | Green flash all gates (or mapped effect) |
| `heat.finished` | RD presses Finish or auto-finish | Red hold / fade off |
| `pilot.crossing` | Every start/finish crossing (holeshot + laps) | Flash gate in **pilot color**; includes pilot info + color |

Suggested TypeScript shape (adjust when real payloads are known):

```ts
type RaceEvent =
  | { type: "heat.loaded"; heat: HeatInfo; pilots: Pilot[] }
  | { type: "heat.arm_started"; heat: HeatInfo }
  | { type: "heat.go"; heat: HeatInfo }
  | { type: "heat.finished"; heat: HeatInfo }
  | { type: "pilot.crossing"; pilot: Pilot; crossing: CrossingInfo };

type Pilot = {
  id: string;
  name: string;
  color: { r: number; g: number; b: number }; // or hex — TBD
  seat?: number;
};
```

---

## Config model (JSON)

Single file `data/config.json` (gitignored), validated with Zod on load/save. Atomic write via temp file + rename.

```ts
{
  version: 1,
  settings: { nextWsUrl: "ws://127.0.0.1:9400" },
  gates: Gate[],
  mappings: EventMapping[]
}
```

### Entities

**gates** — `id`, `host`, `isStartGate`, `enabled`, `sortOrder`

**mappings** — `id`, `eventType`, `target` (`all` | `start_gate` | `gate_id`), `targetGateId`, `action` (JSON), `enabled`

**settings** — `nextWsUrl` (and future keys)

Export/import: `GET/POST /api/config`

Override path for tests: `GATESTAGE_CONFIG_PATH` env var.

Store in user data dir when packaged with Electron; dev: `./data/config.json`.

---

## Suggested repo layout

```txt
GateStage/
├── server.ts                 # HTTP + Next handler + Socket.io + start RaceBrain
├── instrumentation.ts        # alt: boot RaceBrain if not using custom server
├── lib/
│   ├── race-brain.ts         # singleton orchestrator
│   ├── next-listener.ts      # WebSocket client → Next RD
│   ├── gate-engine.ts        # event → actions, debounce pilot.crossing
│   ├── esphome.ts            # fetch() wrapper for REST
│   ├── broadcaster.ts        # Socket.io emit helpers
│   ├── config/               # Zod schema + JSON store
│   │   ├── schema.ts
│   │   └── store.ts
├── mocks/
│   ├── next-ws-server.ts     # Mock Next RD WebSocket + HTTP control
│   ├── esphome-mock-server.ts
│   └── fixtures/race-events.ts
├── e2e/                      # Playwright tests
├── app/
│   ├── page.tsx              # live dashboard
│   ├── gates/page.tsx
│   ├── mappings/page.tsx
│   ├── manual/page.tsx
│   ├── api/
│   │   ├── gates/route.ts
│   │   ├── mappings/route.ts
│   │   ├── manual/[gateId]/route.ts
│   │   └── health/route.ts
│   └── layout.tsx
├── hooks/use-race-socket.ts
├── docs/                     # this folder
└── data/                     # config.json (gitignored)
```

---

## Race brain lifecycle

```
1. Server starts → RaceBrain.init()
2. Load gates + mappings from JSON config
3. Connect WebSocket to Next RD app
4. On message → parse → validate (Zod) → GateEngine.dispatch()
5. GateEngine → parallel fetch() to ESPHome gates (Promise.allSettled)
6. Emit to Socket.io:
   - race:event     (raw event received)
   - race:action    (what was sent to which gate)
   - gate:health    (optional periodic ping)
7. On config change via API → persist → emit config:updated
8. Reconnect Next WS on disconnect with backoff
```

### Socket.io events (server → clients)

```ts
"race:event"    // { type, payload, at }
"race:action"   // { gateId, command, success, error? }
"config:updated"
"gate:health"   // { gateId, online }
"connection:next" // { nextConnected: boolean }
```

---

## UI pages (v1)

1. **Dashboard** — Next connection status, live event feed, gate actions
2. **Gates** — CRUD gates, mark start gate, test button per gate
3. **Mappings** — per event type: target + action builder
4. **Manual** — per-gate on/off/color/effect (race-day override)

No login page in v1.

Visual system (colors, typography, semantic tokens): [DESIGN.md](./DESIGN.md).

---

## ESPHome integration (v1)

Use `web_server` REST only. See [ESPHOME.md](./ESPHOME.md).

```ts
// lib/esphome.ts
export async function turnOnEffect(host: string, entity: string, effect: string) {
  const url = `http://${host}/light/${encodeURIComponent(entity)}/turn_on?effect=${encodeURIComponent(effect)}`;
  return fetch(url, { method: "POST" });
}

export async function turnOnRgb(host: string, entity: string, r: number, g: number, b: number, brightness = 200) {
  const q = new URLSearchParams({ color_mode: "rgb", r: String(r), g: String(g), b: String(b), brightness: String(brightness) });
  const url = `http://${host}/light/${encodeURIComponent(entity)}/turn_on?${q}`;
  return fetch(url, { method: "POST" });
}
```

---

## Default mapping suggestions (seed data)

| Event | Target | Action |
|-------|--------|--------|
| `heat.loaded` | `start_gate` | Show pilot colors (sequence or first pilot — TBD) |
| `heat.arm_started` | `start_gate` | Effect: `Pulse` or custom countdown |
| `heat.go` | `all` | Solid green or effect `Strobe` green |
| `heat.finished` | `all` | Solid red, then off after N seconds |
| `pilot.crossing` | `start_gate` | `pilot_color` from event payload |

---

## Implementation phases

### Phase 1 — Scaffold
- [x] Init Next.js + TypeScript + Tailwind + shadcn
- [x] Custom `server.ts` with Socket.io
- [x] Zod-validated JSON config (gates, mappings)
- [x] No auth (LAN trust model)

### Phase 2 — Gates without Next
- [x] Gates CRUD API + UI
- [x] `lib/esphome.ts` + manual test from UI
- [x] Mock ESPHome for dev (`mocks/esphome-mock-server.ts`)

### Phase 3 — Next listener
- [ ] Discover Next WebSocket URL and payload format (**blocker for production**)
- [x] `next-listener.ts` + parse/log events
- [x] Mock Next server (`mocks/next-ws-server.ts`)
- [x] Live console on dashboard via Socket.io

### Phase 4 — Automation
- [x] Mappings CRUD UI
- [x] `gate-engine.ts` wired to listener
- [x] Debounce duplicate `pilot.crossing`
- [x] Starting gate logic

### Phase 5 — Polish
- [ ] Gate health checks in UI (ping exists in API)
- [ ] Reconnect / error states in UI
- [x] Export/import config JSON (`/api/config`)
- [x] README run instructions

### Phase 5b — Testing
- [x] Playwright E2E against mocks

### Phase 6 — Distribution (later)
- [ ] `output: 'standalone'` in next.config
- [ ] Electron wrapper + tray icon showing crew URL
- [ ] electron-builder Mac/Windows targets
- [ ] DB in `app.getPath('userData')`

---

## Open questions / blockers

1. **Next WebSocket API** — Not publicly documented. Need from go-next.co:
   - URL (likely `ws://127.0.0.1:?` on RD machine)
   - Auth if any
   - Exact JSON schema for `heat.loaded`, `pilot.crossing`, etc.
   - **Workaround for dev:** mock event stream + fixture JSON until spec arrives

2. **Pilot color format** — RGB object, hex string, or seat-index lookup?

3. **Which gate flashes on `pilot.crossing`?** — Start gate only, or configurable per venue (e.g. finish gate)?

4. **ESPHome entity names** — Standardize across gates or per-gate config field?

5. **Port** — Default `8080`? Configurable?

---

## Dev environment assumptions

- Race director laptop: **macOS or Windows**
- GateStage runs locally alongside Next desktop app
- ESPHome gates on same subnet (Nuclear Hazard race WiFi, 192.168.x.x typical)
- RotorHazard timer IP configured in Next separately (existing plugin)

### Local dev without hardware

- `npm run dev:mocks` — starts mock Next WS, mock ESPHome, and GateStage
- Mock Next HTTP: `POST http://127.0.0.1:9401/emit` or `/sequence`
- Mock ESPHome state: `GET http://127.0.0.1:9080/state`
- Playwright E2E: `npm run test:e2e`

---

## Electron distribution notes (future)

- Package with **Electron + electron-builder**
- Nuclear Hazard crew URL pattern: `http://<rd-laptop-lan-ip>:8080`
- Bind server to `0.0.0.0`
- macOS notarization / Windows code signing optional for early releases
- GitHub Releases for .dmg + .exe

---

## Naming / branding

- **Product:** GateStage
- **Repo:** `pluggedinn/GateStage` on GitHub
- Avoid names too close to Next (`NXT Gates`, etc.)

---

## References

- Next: https://go-next.co/
- RotorHazard: https://www.rotorhazard.com/
- NuclearQuads timers: https://nuclearquads.com/
- ESPHome web API: https://esphome.io/web-api/
- Next ↔ RH plugin: https://github.com/gvotteler/next-rotorhazard-plugin
- OpenRace (similar MQTT gate idea): https://github.com/openrace/OpenRace

---

## First commands for implementing agent

```bash
cd GateStage
npm install
npm run dev:mocks
```

Then open http://127.0.0.1:8080 and emit events via mock Next HTTP API.

**Priority order:** server brain → ESPHome manual control → Next listener (mock) → mappings → UI → Playwright → Electron.
