# GateStage

**LED gate control for FPV whoop races.**

GateStage listens to race events from the [Next](https://go-next.co/) race director app and drives ESPHome-controlled LED gates on the course. It runs as a local server on the race director laptop; crew and other devices connect via browser on the same race WiFi.

## What it does

- Connects to the Next race director app (WebSocket) for live race events
- Triggers LED gate animations based on configurable rules
- Provides a web UI for gate setup, event mappings, manual control, and a live event console
- Allows multiple devices on the race LAN to view settings and live activity

## Race-day context

GateStage is one piece of a larger whoop racing setup:

| Component | Role |
|-----------|------|
| **Nuclear Hazard** (Raspberry Pi 4) | Race WiFi AP + RotorHazard lap timing (RSSI from VTX) |
| **Next app** | Race director software (heats, pilots, frequencies, streaming) |
| **GateStage** (this project) | LED gate automation driven by Next events |
| **ESP32-C5 gates** | ESPHome + 12V LED strips at start/finish and course gates |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full hardware/network diagram and [docs/HANDOFF.md](./docs/HANDOFF.md) for implementation details aimed at developers/agents picking up this repo.

## Status

**Planning / not yet implemented.** The repo contains project documentation only. Start with [docs/HANDOFF.md](./docs/HANDOFF.md).

## Docs

- [HANDOFF.md](./docs/HANDOFF.md) — master doc for agents: stack, plan, events, open questions
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — physical setup, networking, data flow
- [ESPHOME.md](./docs/ESPHOME.md) — recommended gate firmware configuration
