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
curl http://127.0.0.1:9080/state
```

## Ports

| Service | Port | URL |
|---------|------|-----|
| GateStage | 8080 | http://127.0.0.1:8080 |
| Mock Next WebSocket | 9400 | ws://127.0.0.1:9400 |
| Mock Next HTTP control | 9401 | http://127.0.0.1:9401 |
| Mock ESPHome | 9080 | http://127.0.0.1:9080 |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | GateStage server only (expects mocks or real hardware) |
| `npm run dev:mocks` | Mocks + GateStage |
| `npm run mock:next` | Mock Next RD WebSocket server |
| `npm run mock:esphome` | Mock ESPHome REST server |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run build` | Production build |

## Config

Settings are stored in `data/config.json` (Zod-validated JSON, gitignored). **Gates are discovered automatically** via mDNS (`_esphomelib._tcp`) on startup and every 60 seconds. Manual add is available on `/gates` as a fallback.

Trigger a scan anytime:

```bash
curl -X POST http://127.0.0.1:8080/api/gates/discover
```

In dev, the mock ESPHome host (`ESPHOME_MOCK_HOST`, default `127.0.0.1:9080`) is included in discovery even without mDNS.

Export/import via `GET/POST /api/config`.

## Docs

- [HANDOFF.md](./docs/HANDOFF.md) — implementation guide for agents
- [DESIGN.md](./docs/DESIGN.md) — UI design system and semantic color tokens
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — hardware/network context
- [ESPHOME.md](./docs/ESPHOME.md) — gate firmware setup (sample: [`docs/examples/gate.yaml`](./docs/examples/gate.yaml))

## Race environment

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). GateStage binds to `0.0.0.0` so crew on race WiFi can open `http://<rd-laptop-ip>:8080`. No login in v1 — trusted race LAN.
