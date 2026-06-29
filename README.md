# GateStage

**LED gate control for FPV whoop races.**

GateStage listens to race events from the [Next](https://go-next.co/) race director app and drives ESPHome-controlled LED gates on the course. It runs as a local server on the race director laptop; crew connect via browser on the same race WiFi.

## Quick start (dev with mocks)

No real Next app or ESP32 required — mock servers simulate both:

```bash
npm install
npm run dev:mocks
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080)

### Emit a test race event

```bash
curl -X POST http://127.0.0.1:9401/emit \
  -H 'Content-Type: application/json' \
  -d '{"type":"heat.go"}'
```

Run a full heat sequence (fast):

```bash
curl -X POST http://127.0.0.1:9401/sequence \
  -H 'Content-Type: application/json' \
  -d '{"speed":20}'
```

### Check mock ESPHome gate commands

```bash
curl http://127.0.0.1:9080/state   # gate-start
curl http://127.0.0.1:9085/state   # gate-finish
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| GateStage | 8080 | http://127.0.0.1:8080 |
| Mock Next WebSocket | 9400 | ws://127.0.0.1:9400 |
| Mock Next HTTP control | 9401 | http://127.0.0.1:9401 |
| Mock ESPHome fleet | 9080–9085 | gate-start … gate-finish |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | GateStage server only (expects mocks or real hardware) |
| `npm run dev:mocks` | Mocks + GateStage |
| `npm run mock:next` | Mock Next RD WebSocket server |
| `npm run mock:esphome` | Six mock ESPHome REST servers (ports 9080–9085) |
| `npm run mock:esphome:single` | One mock ESPHome server on port 9080 |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run build` | Production build |

## Config

Settings are stored in `data/config.json` (Zod-validated JSON, gitignored). **Gates are synced from the network** via mDNS (`_esphomelib._tcp`) on startup and every 15 seconds — only reachable devices on the LAN appear in the list.

Trigger a scan anytime:

```bash
curl -X POST http://127.0.0.1:8080/api/gates/discover
```

In dev (`ESPHOME_MOCK_FLEET=1`), six mock gates are included in discovery: `gate-start`, `gate-2` … `gate-5`, `gate-finish` on ports 9080–9085.

Export/import via `GET/POST /api/config`.

## Docs

- [HANDOFF.md](./docs/HANDOFF.md) — implementation guide for agents
- [DESIGN.md](./docs/DESIGN.md) — UI design system and semantic color tokens
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — hardware/network context
- [ESPHOME.md](./docs/ESPHOME.md) — gate firmware setup ([`docs/examples/gate.yaml`](./docs/examples/gate.yaml), XIAO ESP32-C5 + WS2811)

## Race environment

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). GateStage binds to `0.0.0.0` so crew on race WiFi can open `http://<rd-laptop-ip>:8080`. No login in v1 — trusted race LAN.
