# GateStage — Design System

Visual north star for the web UI. Read this before changing layout, colors, or typography.

**Anchor:** Linear-style tool shell + race-ops semantics (custom hybrid — not a recipe copy-paste).

---

## Context

| Dimension | Choice |
|-----------|--------|
| **Product** | Local race-ops console — config before the race, live monitoring during |
| **Viewing distance** | Arm's-length tablet or laptop at the field (~1 m) |
| **Visual temperature** | Quiet, authoritative, tool-like — not marketing polish |
| **Audience** | Race director and crew on trusted LAN |

Per the [web-design-engineer skill](../.cursor/skills/web-design-engineer/SKILL.md), this is a **dashboard / data product**: functionality and craft matter more than showcase originality.

---

## Design decisions

| Token | Value | Notes |
|-------|-------|-------|
| **Ground** | Light: `oklch(1 0 0)` / Dark: `oklch(0.145 0 0)` | `next-themes` — system default, manual toggle in nav |
| **Surface** | `oklch(0.205 0 0)` card layer | Hairline `border-border` between panels |
| **Accent (brand)** | `--status-ok` emerald | LED "go" green; use on **< 5% of pixels** (logo, active nav, live events) |
| **Typography — UI** | Arimo, 16px body target | `--font-sans` / `--font-heading` |
| **Typography — data** | System mono stack | Event types, gate IDs, timestamps — `font-mono tabular-nums` |
| **Spacing** | 8pt grid | 8 / 16 / 24 / 32 / 48 (`space-y-6` = 24px section rhythm) |
| **Radius** | `0.625rem` (10px) | Modest; avoid gummy large radii on ops UI |
| **Motion** | 150ms ease-out for hover | Honor `prefers-reduced-motion` |

---

## Semantic status colors

All status and race meaning flows through CSS custom properties — **no raw Tailwind color classes** (`emerald-400`, `zinc-500`, etc.) in components.

| Token | Role | Light (`:root`) | Dark (`.dark`) |
|-------|------|-----------------|----------------|
| `--status-ok` | Connected, success, `heat.go` | `oklch(0.55 0.14 155)` | `oklch(0.75 0.15 155)` |
| `--status-warn` | Arm / caution, `heat.arm_started` | `oklch(0.58 0.14 75)` | `oklch(0.78 0.14 75)` |
| `--status-error` | Fail, disconnect, `heat.finished` off-state | `oklch(0.55 0.2 25)` | `oklch(0.65 0.2 25)` |
| `--status-muted` | Inactive, unknown, disconnected dot | `oklch(0.55 0.02 265)` | `oklch(0.45 0.02 265)` |

Tailwind utilities: `text-status-ok`, `bg-status-warn`, `border-status-error`, etc. (mapped in `app/globals.css`).

### Event type → color (dashboard)

| Event | Color token |
|-------|-------------|
| `heat.go` | `status-ok` |
| `heat.arm_started` | `status-warn` |
| `heat.loaded` | `foreground` / muted |
| `heat.finished` | `status-error` or muted |
| `pilot.crossing` | `status-ok` (pilot color follows payload in Phase C+) |

---

## Page roles

| Page | Density | Priority |
|------|---------|----------|
| **Dashboard** | Glanceable — status strip + latest-event hero | Live connection + latest event |
| **Gates / Mappings** | Denser tables | Pre-race configuration |
| **Manual** | Large touch targets + live LED preview | Race-day override |

---

## Anti-patterns (do not introduce)

- Purple-pink gradients, emoji icons, left-border accent cards
- Hardcoded Tailwind palette colors for status (use semantic tokens)
- Decorative color — every hue must encode connection, event, or LED state
- Fabricated stats or fake gate data in the UI

---

## Implementation map

| File | Role |
|------|------|
| `app/globals.css` | Token definitions + `@theme` Tailwind bridge |
| `components/providers.tsx` | `ThemeProvider` (system default) |
| `components/theme-toggle.tsx` | Sun/moon toggle in nav |
| `components/connection-status.tsx` | Socket + Next indicators in nav |
| `components/nav.tsx` | Brand accent + active route + connections + theme toggle |
| `hooks/use-race-socket.tsx` | Shared `RaceSocketProvider` (single socket) |
| `app/layout.tsx` | `text-base` on body; theme class on `<html>` via `next-themes` |
| `app/page.tsx` | Status strip, event semantics, action color swatches |
| `lib/event-status.ts` | Event type → status token mapping |
| `components/dashboard/status-strip.tsx` | Dashboard race status (gates + last event) |
| `lib/broadcaster.ts` | Event/action buffer + replay on socket connect |
| `components/led-strip-preview.tsx` | Live strip preview (solid / effect / off) |
| `app/manual/page.tsx` | Preview card, 44px touch targets |

Done: Phase E (light/dark via `next-themes`, system default). Design rollout complete (Phases A–E).
