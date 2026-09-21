# GateStage — ESPHome Gate Configuration

Recommended firmware for each LED gate. GateStage discovers gates via a **UDP beacon** on port **9420** and controls them over **HTTP REST** (`web_server`). Firmware still includes `mdns:` so ESPHome OTA and `gate-start.local` work in a browser — GateStage does not browse mDNS.

---

## Sample config (copy and flash)

Full working example: [`docs/examples/gate.yaml`](./examples/gate.yaml)

```bash
cd docs/examples
esphome run gate.yaml              # defaults to gate-1
esphome -s gate_id 3 run gate.yaml # flash as gate-3
./flash-gate.sh 3                  # same, via helper script
```

GateStage will add the gate when it hears its UDP beacon (usually within a few seconds of joining WiFi).

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
  networks:
    - ssid: "I dont take naps-5G"
      password: "broccoli"
    - ssid: "Whoop Racing"
      password: "tinywhoop"
  band_mode: 5GHZ
  fast_connect: true
```

At a **race venue**, the gate joins whichever of those SSIDs is present. There is **no fallback hotspot** — a dropout stays on the race channel and keeps retrying.

Station mode is **5 GHz only** (`band_mode: 5GHZ`). Use a 5 GHz SSID (or a race AP on Channel 36).

To change firmware (strip buffer size in `num_leds`, pins, effects), recompile and flash. **Active LED count** is runtime-tunable (see below). GateStage will not discover the gate until it joins your LAN WiFi.

`fast_connect: true` skips a full scan on reconnect and tries the last BSSID/channel first. With two SSIDs in the YAML, that is the last network that succeeded (home or race).

### API `encryption` (not needed here)

The `api:` block is ESPHome’s **native API** (port 6053) for Home Assistant and the ESPHome dashboard — encrypted binary protocol, unrelated to WiFi passwords.

**GateStage does not use it.** GateStage only talks to `web_server` over plain HTTP on port 80.

The sample uses a bare `api:` with no `encryption:` key. That is fine on a trusted race LAN. You can drop `api:` entirely if you never connect Home Assistant or the ESPHome app to the gate.

### Gate ID = substitution `gate_id`

The sample uses an ESPHome **substitution** so one YAML works for every gate. Firmware hostname stays `gate` (plus a MAC suffix for unique mDNS) so compiling a second ID does not wipe the ESP-IDF tree. GateStage still identifies the device from the UDP beacon `id` (`gate-3`, `gate-start`, …).

```yaml
substitutions:
  gate_id: "1"   # default; override at flash time

esphome:
  name: gate
  friendly_name: Gate ${gate_id}
  name_add_mac_suffix: true
```

Pass `gate_id` when flashing each physical device:

```bash
esphome -s gate_id start run gate.yaml   # beacon id gate-start
esphome -s gate_id finish run gate.yaml  # beacon id gate-finish
esphome -s gate_id 3 run gate.yaml       # beacon id gate-3
```

---

## Minimum requirements for GateStage

| Component | Why |
|-----------|-----|
| `wifi` + `band_mode: 5GHZ` | Race LAN is 5 GHz only |
| `mdns` | ESPHome OTA / `*.local` only (GateStage does not query it) |
| `udp` port **9420** | Presence beacon + WHO reply |
| `wifi_signal` / `internal_temperature` | RSSI and chip temp in the beacon |
| `web_server` port 80 | GateStage HTTP commands |
| `light` named **`Gate LEDs`** | Fixed entity name GateStage calls |

### UDP beacon

Every ~3s (and on WiFi connect / WHO) the gate broadcasts to `255.255.255.255:9420`:

```json
{"v":1,"id":"gate-start","rssi":-62,"tC":47.5,"up":120,"dc":2,"rssiMin":-81}
```

`up` is uptime seconds, `dc` is WiFi disconnects since boot, `rssiMin` is the worst RSSI since boot. Older firmware without those fields still works.

GateStage learns `host` from the **sender IP**. Scan Now broadcasts `{"v":1,"q":"who"}` on the same port; gates reply with a beacon.

---

## Light effects

GateStage and the sample gate firmware share the same effect catalog in **`lib/effects.ts`** (shown in the Manual and Mappings UI).

| Category | Effects |
|----------|---------|
| **Basic** | Pulse, Strobe |
| **Strip** | Rainbow, Color Wipe, Comet |

When GateStage runs an effect it:

1. Sets runtime parameters via ESPHome **`number`** REST entities (`FX Rainbow Speed`, etc.) when supported
2. Calls `POST /light/Gate%20LEDs/turn_on?effect=<name>`

**Runtime-tunable** (REST number/switch entities or ESPHome web UI):

| Entity | Effect / purpose |
|--------|------------------|
| Active LEDs | Strip length (all effects) |
| FX Rainbow Speed / Width | Rainbow |
| FX Pulse Transition / Cycle Interval / Min Brightness / Max Brightness | Pulse |
| FX Strobe Period / On Time / Start Delay | Strobe |
| FX Color Wipe Interval / Reverse | Color Wipe |
| FX Comet Width / Count / Interval / Max Brightness / Reverse | Comet |

Strobe defaults to a 400ms cycle with 200ms on (same look as the old hardcoded flash). Period, on-time, and start delay are runtime-tunable. Color Wipe fills the active range with the selected color, then wipes to off.

All five effects only animate the active LED range; pixels above that stay off.

On boot the strip always starts **Rainbow at 60%**. Last color/effect is not restored (`restore_mode: ALWAYS_ON`). Active LED count is still remembered.

**Firmware-only** (edit `gate.yaml` and reflash): `num_leds` buffer ceiling (400 in sample).

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
POST http://192.168.4.21/number/FX%20Comet%20Width/set?value=8
POST http://192.168.4.21/number/FX%20Comet%20Count/set?value=3
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=None
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=Rainbow
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=Comet&color_mode=rgb&r=0&g=255&b=0&brightness=200
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
# or: ./flash-gate.sh start --device 10.3.141.118 --no-logs
```

`esphome.name` is stable (`gate`), so the first compile is a full ESP-IDF build and later `gate_id`s only rebuild `main.cpp`. Do not compile two IDs at once. `./flash-gate.sh` also enables **ccache**.

### Verify with GateStage

1. Start GateStage on a machine on the **same WiFi subnet** as the gate (beacons are a UDP broadcast)
2. Open **Gates** — a flashed gate should appear within a few seconds (UDP beacon), or run `POST /api/gates/discover`
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
| gate-start | (auto / UDP beacon) | yes | 60 | 400 | XIAO ESP32-C5 | WS2811, D8 |

GateStage picks up discovered gates automatically; mark the start gate in the Gates UI.
