<h1 align="center">GateStage</h1>

<p align="center">
  <a href="#"><img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue?style=flat-square" /></a>
  <a href="https://go-next.co/"><img alt="Next RD" src="https://img.shields.io/badge/Next-race%20director-111?style=flat-square" /></a>
  <a href="https://esphome.io/"><img alt="ESPHome" src="https://img.shields.io/badge/ESPHome-LED%20gates-2E7DFF?style=flat-square" /></a>
</p>

<h3 align="center">LED gate control for FPV whoop races.</h3>

Your race director laptop is already running a race manager — heats, pilots, frequencies, the stream.
But when the heat goes live, who's driving the start gate, finish arch, and LED cues on the course?

GateStage listens to race events from supported race managers and commands ESPHome gates over the race LAN — so lights go green when they should, without another app to babysit or a cloud hop in between.

## What it is

FPV whoop races need synchronized LED gates — start lights, finish arches, status cues — tied to what your race manager is doing in the heat.

GateStage is a local server that runs beside your race manager on the race director laptop.
It subscribes to race events, maps them to gate behaviors you've configured, and drives ESP32 + ESPHome hardware over HTTP on the LAN.
A web UI serves configuration, manual control, and a live event console to the RD and crew tablets on the same WiFi.

This is not a lap timer — that's Nuclear Hazard / RotorHazard.
This is not a replacement for your race manager.
This is the glue between your race manager and your LED gates.

### Supported race managers

| Race manager | Supported | Status |
|--------------|-----------|--------|
| [Next](https://go-next.co/) | ✓ | Available |
| FPV Trackside | ✗ | Work in progress |
| RotorHazard | ✓ | Available (Socket.io; pilot names pending) |

Select your provider in **Settings**. Only Next connects today; other integrations are placeholders while protocol work is underway.

## Features

- **One brain on the RD laptop** — GateStage owns the race manager connection, event mapping, and ESPHome commands; browsers are thin clients.
- **Event-driven gate control** — heat start, finish, and configurable routines from race events.
- **Automatic gate discovery** — mDNS scans the race WiFi for ESPHome devices on startup and every 15 seconds.
- **Crew-friendly** — binds to `0.0.0.0` so anyone on race WiFi can open settings, the live console, or manual override.
- **Zod-validated config** — settings in `data/config.json` with export/import via `GET/POST /api/config`.
- **Dev without hardware** — mock Next and ESPHome servers simulate a full heat sequence on your laptop.

## Quick Start

**Requirements:** Node.js 20+, npm.

No real Next app or ESP32 required — mock servers simulate both:

```sh
npm install
npm run dev:mocks
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080)

Emit a test race event:

```sh
curl -X POST http://127.0.0.1:9401/emit \
  -H 'Content-Type: application/json' \
  -d '{"type":"heat.go"}'
```

Run a full heat sequence (fast):

```sh
curl -X POST http://127.0.0.1:9401/sequence \
  -H 'Content-Type: application/json' \
  -d '{"speed":20}'
```

Check mock ESPHome gate commands:

```sh
curl http://127.0.0.1:9080/state   # gate-start
curl http://127.0.0.1:9085/state   # gate-finish
```

## How It Works

```
  Race manager (e.g. Next)
  (race director laptop)
       │  WebSocket race events
       ▼
 ┌─────────────────────────────────┐
 │ GateStage server                │
 │ maps events → gate actions      │
 │ persists config (JSON)          │
 └──┬──────────────┬───────────────┘
    │ HTTP REST  │ Socket.io
    ▼            ▼
 ESPHome      Browser UIs
 gates        (RD + crew on race WiFi)
 (ESP32-C5)
```

GateStage runs on the same laptop as your race manager.
The server connects over WebSocket (Next today), translates race events into ESPHome REST calls, and broadcasts live events to every browser tab on the race LAN.
Gate discovery uses mDNS (`_esphomelib._tcp`) so only reachable devices on the LAN appear in your gate list.

Full hardware and networking context lives in [AGENTS.md](./AGENTS.md#architecture).

## Configuration

Settings are stored in `data/config.json` (gitignored).
Gates sync from the network via mDNS on startup and every 15 seconds.

Trigger a scan anytime:

```sh
curl -X POST http://127.0.0.1:8080/api/gates/discover
```

With `npm run dev:mocks` (`ESPHOME_MOCK_FLEET=1`), six mock gates join discovery on ports 9080–9085: `gate-start`, `gate-2` … `gate-5`, `gate-finish`.

Export/import via `GET/POST /api/config`.

### Dev ports

| Service | Port | URL |
|---------|------|-----|
| GateStage | 8080 | http://127.0.0.1:8080 |
| Mock Next WebSocket | 9400 | ws://127.0.0.1:9400 |
| Mock Next HTTP control | 9401 | http://127.0.0.1:9401 |
| Mock ESPHome fleet | 9080–9085 | gate-start … gate-finish |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:mocks` | Mock Next + mock ESPHome + GateStage |
| `npm run dev` | GateStage server only (expects mocks or real hardware) |
| `npm run mock:next` | Mock Next RD WebSocket server |
| `npm run mock:esphome` | Six mock ESPHome REST servers (ports 9080–9085) |
| `npm run mock:esphome:single` | One mock ESPHome server on port 9080 |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run build` | Production build |
| `npm run start` | Production server |

## Documentation

- [AGENTS.md](./AGENTS.md) — **start here for coding agents** (architecture, conventions, commands)
- [docs/DESIGN.md](docs/DESIGN.md) — UI design system and semantic color tokens
- [docs/ESPHOME.md](docs/ESPHOME.md) — gate firmware setup ([docs/examples/gate.yaml](docs/examples/gate.yaml), XIAO ESP32-C5 + WS2811)

## Race environment

GateStage runs on the **race director laptop** alongside your race manager (e.g. [Next](https://go-next.co/)). ESP32 gates join the **same 5 GHz race WiFi** as the laptop. Server binds to `0.0.0.0` so crew open `http://<rd-laptop-ip>:8080`. No login in v1 — trusted LAN.

**Race day checklist**

1. Race WiFi AP up (5 GHz; Channel 36 preferred — keeps WiFi away from analog VTX on Raceband)
2. RD laptop on race WiFi; race manager running (Next + RotorHazard timer, or your chosen stack)
3. GateStage running; crew URL shared
4. All ESP32 gates online on race WiFi (DHCP reservations help)
5. Internet optional — timing and gate control work offline on the LAN

## License

MIT — see [LICENSE](./LICENSE).
