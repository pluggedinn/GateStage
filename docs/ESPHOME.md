# GateStage — ESPHome Gate Configuration

Recommended firmware setup for each LED gate ESP32-C5. Adjust per actual strip type and wiring.

---

## Requirements

- ESP32-C5 on **5 GHz race WiFi** (same SSID as GateStage server)
- Lock to 5 GHz in ESPHome when supported:

```yaml
wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password
  band_mode: 5GHZ  # ESP32-C5, recent ESPHome
```

- Static IP or DHCP reservation on the Nuclear Hazard router (recommended)

---

## Minimum components

```yaml
esphome:
  name: gate-start
  friendly_name: Start Gate

esp32:
  board: esp32-c5-devkitc-1
  framework:
    type: esp-idf  # required for ESP32-C5

api:
  encryption:
    key: !secret api_key

web_server:
  port: 80

# LED strip — adjust platform/pin/count for your hardware
light:
  - platform: esp32_rmt_led_strip
    id: gate_led
    name: "Gate LEDs"
    pin: GPIO8
    num_leds: 60
    rgb_order: GRB
    chipset: ws2812
    effects:
      - pulse:
          name: Pulse
      - strobe:
          name: Strobe
      - random:
          name: Random
      - rainbow:
          name: Rainbow
```

GateStage v1 will call gates via **HTTP REST** (`web_server`). Example:

```http
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?effect=Rainbow
POST http://192.168.4.21/light/Gate%20LEDs/turn_on?color_mode=rgb&r=255&g=0&b=0&brightness=200
POST http://192.168.4.21/light/Gate%20LEDs/turn_off
```

---

## Optional: API actions (lower latency / custom scenes)

For richer control later, expose named actions:

```yaml
api:
  actions:
    - action: show_pilot
      variables:
        r: int
        g: int
        b: int
      then:
        - light.turn_on:
            id: gate_led
            red: !lambda 'return r;'
            green: !lambda 'return g;'
            blue: !lambda 'return b;'
            brightness: 80%

    - action: run_scene
      variables:
        scene: string
      then:
        - light.turn_on:
            id: gate_led
            effect: !lambda 'return scene;'
```

Native API requires a Node client library (not REST). Defer until after REST v1 works.

---

## Power / wiring notes

- **12V strips** — power from dedicated PSU, not from ESP
- **Common ground** between ESP and strip PSU
- **Data line level** — use appropriate level shifter if strip expects 5V data
- **Inrush** — size PSU for full strip brightness; brownouts reboot ESP

---

## Gate inventory (fill in per venue)

| Gate ID | Friendly name | IP | Is start gate? | LED count | Notes |
|---------|---------------|-----|----------------|-----------|-------|
| gate-1 | Start | TBD | yes | TBD | |
| gate-2 | | TBD | no | TBD | |

Copy this table into GateStage config once the app exists.
