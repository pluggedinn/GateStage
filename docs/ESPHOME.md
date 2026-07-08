# GateStage — ESPHome Gate Configuration

Recommended firmware for each LED gate. GateStage discovers gates via **mDNS** (`_esphomelib._tcp`) and controls them over **HTTP REST** (`web_server`).

---

## Sample config (copy and flash)

Full working example: [`docs/examples/gate.yaml`](./examples/gate.yaml)

```bash
cd docs/examples
esphome run gate.yaml              # defaults to gate-1
esphome -s gate_id 3 run gate.yaml # flash as gate-3
./flash-gate.sh 3                  # same, via helper script
```

GateStage will discover the gate automatically once it is on the same LAN as the server.

### Reference hardware (sample defaults)

| Item | Value |
|------|-------|
| Board | [Seeed XIAO ESP32-C5](https://wiki.seeedstudio.com/xiao_esp32c5_getting_started/) |
| Strip | WS2811, 60 LEDs typical (400 max buffer in firmware) |
| Data pin | **D8** → `GPIO8` |
| Power | 12 V strip PSU (separate); ESP drives **data only** |
| Networking | DHCP (no static IP in YAML) |

**Wiring:** Connect strip **GND** to XIAO **GND**. Connect strip **DATA** to **D8**. Do **not** power the 12 V strip from the XIAO. If colors look wrong after flashing, try `rgb_order: RGB` instead of `GRB` in `gate.yaml`.

### WiFi credentials

Edit the `wifi:` block in `gate.yaml` before flashing:

```yaml
wifi:
  ssid: "I dont take naps-5G"
  password: "broccoli"
  ap:
    password: "broccoli"
```

At a **race venue**, change `ssid` / `password` to the race AP (e.g. Nuclear Hazard: `Whoop Racing` / `tinywhoop`) and reflash, or use the fallback captive portal on race day.

### WiFi behavior

| Mode | When | SSID |
|------|------|------|
| **Station** | Your WiFi is available | `wifi.ssid` in `gate.yaml` |
| **Fallback AP** | Cannot join WiFi within `ap_timeout` | `GateStage-<esphome.name>` (e.g. `GateStage-gate-start`) |

Station mode is **5 GHz only** (`band_mode: 5GHZ`). Use a 5 GHz SSID (or a race AP on Channel 36).

When a gate is in fallback AP mode, connect to `GateStage-<name>` and open **`http://192.168.4.1`**. You get:

- **Captive portal** — change WiFi SSID/password if the network moved
- **Web UI** — turn LEDs on/off, pick colors and effects (same as on LAN)
- **REST API** — the HTTP endpoints GateStage uses

That is **not** full ESPHome reconfiguration: you cannot edit YAML or add new components from the browser. To change firmware (strip buffer size in `num_leds`, pins, effects), recompile and flash. **Active LED count** is runtime-tunable (see below). GateStage will not discover the gate until it joins your LAN WiFi.

### `ap_timeout`

How long the gate keeps trying your configured WiFi before it turns on the fallback hotspot. We use **`60s`** in the sample (ESPHome default is `90s`). Set `ap_timeout: 0s` if you never want automatic fallback AP.

### API `encryption` (not needed here)

The `api:` block is ESPHome’s **native API** (port 6053) for Home Assistant and the ESPHome dashboard — encrypted binary protocol, unrelated to WiFi passwords.

**GateStage does not use it.** GateStage only talks to `web_server` over plain HTTP on port 80.

The sample uses a bare `api:` with no `encryption:` key. That is fine on a trusted race LAN. You can drop `api:` entirely if you never connect Home Assistant or the ESPHome app to the gate.

### Gate ID = `esphome.name`

The sample uses an ESPHome **substitution** so one YAML works for every gate:

```yaml
substitutions:
  gate_id: "1"   # default; override at flash time

esphome:
  name: gate-${gate_id}           # ← GateStage gate id (e.g. gate-3, gate-start)
  friendly_name: Gate ${gate_id}
```

Pass `gate_id` when flashing each physical device:

```bash
esphome -s gate_id start run gate.yaml   # → gate-start
esphome -s gate_id finish run gate.yaml  # → gate-finish
esphome -s gate_id 3 run gate.yaml       # → gate-3
```

The fallback AP SSID (`GateStage-gate-<id>`) uses the same substitution.

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
| **Basic** | Pulse, Strobe |
| **Strip** | Rainbow, Color Wipe |

When GateStage runs an effect it:

1. Sets runtime parameters via ESPHome **`number`** REST entities (`FX Rainbow Speed`, etc.) when supported
2. Calls `POST /light/Gate%20LEDs/turn_on?effect=<name>`

**Runtime-tunable** (REST number/switch entities or ESPHome web UI):

| Entity | Effect / purpose |
|--------|------------------|
| Active LEDs | Strip length (all effects) |
| FX Rainbow Speed / Width | Rainbow |
| FX Pulse Transition / Cycle Interval / Min Brightness / Max Brightness | Pulse |
| FX Color Wipe Interval / Reverse | Color Wipe |

Strobe has no tunable parameters (fixed white → off → red sequence in firmware).

All four effects only animate the active LED range; pixels above that stay off.

**Firmware-only** (edit `gate.yaml` and reflash): `num_leds` buffer ceiling (400 in sample), Strobe colors/timing.

See [ESPHome light effects](https://esphome.io/components/light/index.html#light-effects) for parameter semantics.

---

## GateStage HTTP API (v1)

GateStage sends brightness as **1–100%** in the UI, converted to ESPHome’s **0–255** `brightness` query param on every `turn_on`.

- **Race default:** Manual → Brightness → **Save as race default** (stored in `data/config.json` as `defaultBrightnessPercent`, default **5%**).
- **Manual overrides:** The brightness slider on Manual applies to solid colors and effects for that command.
- **Mappings:** When adding a mapping for solid, effect, or pilot color, set brightness on the same form; it is saved per mapping.

Mappings and pilot-color automation without an explicit brightness use the race default.

```http
POST http://192.168.4.21/number/Active%20LEDs/set?value=45
POST http://192.168.4.21/number/FX%20Rainbow%20Speed/set?value=15
POST http://192.168.4.21/number/FX%20Pulse%20Transition/set?value=800
POST http://192.168.4.21/switch/FX%20Color%20Wipe%20Reverse/turn_on
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=None
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=Rainbow
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?color_mode=rgb&r=255&g=0&b=0&brightness=200
POST http://192.168.4.21/light/Gate%20LEDs/turn_off
```

### Stopping an effect (ESPHome web UI)

The built-in web UI at `http://<gate-ip>/` lists effects including **None**. Pick **None** to return to solid color (keeps the light on). Use the power toggle to turn the light fully off.

If an effect seemed “stuck” on older firmware, the 32 ms inactive-LED mask was still writing to the strip even while an effect was running. Current firmware only runs that mask for solid color (no effect) and clears the strip on `turn_off`.

DHCP is fine (no static IP required). Optional **DHCP reservation** on your router per gate keeps the host stable for debugging.

---

## Flashing

1. `cd docs/examples`
2. Edit `wifi:` credentials in `gate.yaml` if needed
3. Flash each physical gate with a unique `gate_id` (`start`, `finish`, `3`, …)
4. Adjust `num_leds` (firmware buffer ceiling), `pin`, `chipset`, or `rgb_order` only if your hardware differs
5. Flash with ESPHome CLI or dashboard (USB) or OTA after first flash
6. Set **Active LEDs** via the ESPHome web UI or REST to match your physical strip length

```bash
esphome -s gate_id start run gate.yaml
# or: ./flash-gate.sh start
```

### Verify with GateStage

1. Start GateStage on a machine on the **same WiFi** as the gate
2. Open **Gates** — the gate should appear within ~15 s (background mDNS scan), or run `POST /api/gates/discover`
3. Mark **gate-start** as the start gate
4. Use **Test** (rainbow) or **Manual** to confirm LEDs respond

---

## Optional: API actions (future)

Native API actions (lower latency than REST) can be added later. GateStage v1 uses `web_server` only. See ESPHome docs for `api.actions` if you extend beyond v1.

---

## Power / wiring notes

- **12 V strips** — power from dedicated PSU, not from the XIAO
- **Common ground** between XIAO GND and strip PSU negative
- **Data only from ESP** — XIAO D8 → strip DATA IN; 12 V to strip separately
- **Data line level** — many WS2811 12 V modules accept 3.3 V data; use a level shifter if your strip is flaky
- **Inrush** — size PSU for full strip brightness; brownouts on the strip PSU do not need to reset the ESP if logic is powered separately

---

## Gate inventory (fill in per venue)

| Gate ID (`esphome.name`) | Host (DHCP) | Start gate? | Active LEDs | Max buffer | Board | Notes |
|--------------------------|-------------|-------------|-------------|------------|-------|-------|
| gate-start | (auto / mDNS) | yes | 60 | 400 | XIAO ESP32-C5 | WS2811, D8 |

GateStage picks up discovered gates automatically; mark the start gate in the Gates UI.
