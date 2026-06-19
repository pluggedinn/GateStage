# GateStage — ESPHome Gate Configuration

Recommended firmware for each LED gate ESP32-C5. GateStage discovers gates via **mDNS** (`_esphomelib._tcp`) and controls them over **HTTP REST** (`web_server`).

---

## Sample config (copy and flash)

Full working example: [`docs/examples/gate.yaml`](./examples/gate.yaml)

### WiFi behavior

| Mode | When | SSID |
|------|------|------|
| **Station** | Race network available | `Whoop Racing` |
| **Fallback AP** | Cannot join race WiFi within `ap_timeout` | `GateStage-<esphome.name>` (e.g. `GateStage-gate-start`) |

Both modes use password **`tinywhoop`**. Station mode is **5 GHz only** (`band_mode: 5GHZ`) to match the Nuclear Hazard race AP (Channel 36).

When a gate is in fallback AP mode, connect to `GateStage-<name>` and open **`http://192.168.4.1`**. You get:

- **Captive portal** — change WiFi SSID/password if the race network moved
- **Web UI** — turn LEDs on/off, pick colors and effects (same as on race WiFi)
- **REST API** — the HTTP endpoints GateStage uses

That is **not** full ESPHome reconfiguration: you cannot edit YAML or add new components from the browser. To change firmware (LED count, pins, effects), recompile and flash with ESPHome CLI/dashboard. GateStage will not discover the gate until it joins `Whoop Racing`.

### `ap_timeout`

How long the gate keeps trying **`Whoop Racing`** before it turns on the fallback hotspot. We use **`60s`** in the sample (ESPHome default is `90s`). Set `ap_timeout: 0s` if you never want automatic fallback AP.

### API `encryption` (not needed here)

The `api:` block is ESPHome’s **native API** (port 6053) for Home Assistant and the ESPHome dashboard — encrypted binary protocol, unrelated to WiFi passwords.

**GateStage does not use it.** GateStage only talks to `web_server` over plain HTTP on port 80.

The sample uses a bare `api:` with no `encryption:` key. That is fine on a trusted race LAN. You can drop `api:` entirely if you never connect Home Assistant or the ESPHome app to the gate.

### Gate ID = `esphome.name`

Set a unique `name` per gate before flashing:

```yaml
esphome:
  name: gate-start    # ← GateStage gate id
```

Flash `gate-finish`, `gate-3`, etc. as separate devices with the same YAML except for `name` / `friendly_name`.

---

## Minimum requirements for GateStage

| Component | Why |
|-----------|-----|
| `wifi` + `band_mode: 5GHZ` | Race LAN is 5 GHz only |
| `wifi.ap` + `ap_timeout` | Setup hotspot when race WiFi is down |
| `mdns` | Auto-discovery (enabled by default; kept explicit in sample) |
| `web_server` port 80 | GateStage HTTP commands |
| `light` named **`Gate LEDs`** | Fixed entity name GateStage calls |

---

## Light effects

GateStage and the sample gate firmware share the same effect catalog in **`lib/effects.ts`** (shown in the Manual and Mappings UI).

| Category | Effects |
|----------|---------|
| **Basic** | Pulse, Random, Strobe, Flicker |
| **Strip** | Rainbow, Color Wipe, Scan, Twinkle, Random Twinkle, Fireworks, Addressable Flicker |

When GateStage runs an effect it:

1. Sets runtime parameters via ESPHome **`number`** REST entities (`FX Rainbow Speed`, etc.) when supported
2. Calls `POST /light/Gate%20LEDs/turn_on?effect=<name>`

**Runtime-tunable** (REST number entities in sample YAML): Rainbow (`speed`, `width`), Scan (`move_interval`, `scan_width`), Addressable Flicker (`update_interval`, `intensity`).

**YAML-only** (edit `gate.yaml` and reflash): basic effect timing/brightness, Strobe colors, Color Wipe palette, Twinkle / Random Twinkle / Fireworks parameters. The UI still shows these fields so mappings store the intended values.

See [ESPHome light effects](https://esphome.io/components/light/index.html#light-effects) for parameter semantics.

---

## GateStage HTTP API (v1)

GateStage sends brightness as **1–100%** in the UI, converted to ESPHome’s **0–255** `brightness` query param on every `turn_on`.

- **Race default:** Manual → Brightness → **Save as race default** (stored in `data/config.json` as `defaultBrightnessPercent`, default **5%**).
- **Manual overrides:** The brightness slider on Manual applies to solid colors and effects for that command.
- **Mappings:** When adding a mapping for solid, effect, or pilot color, set brightness on the same form; it is saved per mapping.

Mappings and pilot-color automation without an explicit brightness use the race default.

```http
POST http://192.168.4.21/number/FX%20Rainbow%20Speed/set?value=15
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=Rainbow
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?color_mode=rgb&r=255&g=0&b=0&brightness=200
POST http://192.168.4.21/light/Gate%20LEDs/turn_off
```

Use a **DHCP reservation** on the Nuclear Hazard router per gate (recommended) so hosts stay stable.

---

## Flashing

1. Copy `docs/examples/gate.yaml`
2. Change `esphome.name` for each physical gate
3. Adjust `num_leds`, `pin`, and strip `chipset` for your hardware
4. Flash with ESPHome CLI or dashboard while on bench WiFi (or via fallback AP)

```bash
esphome run gate.yaml
```

---

## Optional: API actions (future)

Native API actions (lower latency than REST) can be added later. GateStage v1 uses `web_server` only. See ESPHome docs for `api.actions` if you extend beyond v1.

---

## Power / wiring notes

- **12V strips** — power from dedicated PSU, not from ESP
- **Common ground** between ESP and strip PSU
- **Data line level** — use appropriate level shifter if strip expects 5V data
- **Inrush** — size PSU for full strip brightness; brownouts reboot ESP

---

## Gate inventory (fill in per venue)

| Gate ID (`esphome.name`) | Host (DHCP / reservation) | Start gate? | LED count | Notes |
|--------------------------|---------------------------|-------------|-----------|-------|
| gate-start | TBD | yes | TBD | |
| gate-finish | TBD | no | TBD | |

GateStage picks up discovered gates automatically; mark the start gate in the Gates UI.
