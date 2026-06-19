/**
 * ESPHome built-in light effects for addressable LED strips.
 * @see https://esphome.io/components/light/index.html#light-effects
 */

export type EffectParamType =
  | "int"
  | "percent"
  | "milliseconds"
  | "seconds"
  | "bool";

export type EffectParamDef = {
  key: string;
  label: string;
  type: EffectParamType;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean;
  /** ESPHome REST entity; omitted when the value is fixed in gate YAML */
  entityName?: string;
  yamlOnly?: boolean;
};

export type EffectDef = {
  id: string;
  /** Name passed to ESPHome `turn_on?effect=` */
  name: string;
  category: "basic" | "strip";
  description: string;
  params: EffectParamDef[];
};

export const EFFECT_CATALOG: EffectDef[] = [
  {
    id: "pulse",
    name: "Pulse",
    category: "basic",
    description: "Smooth brightness pulse across the whole strip",
    params: [
      {
        key: "transition_length_ms",
        label: "Transition",
        type: "milliseconds",
        min: 100,
        max: 30_000,
        step: 100,
        default: 1000,
        yamlOnly: true,
      },
      {
        key: "update_interval_ms",
        label: "Cycle interval",
        type: "milliseconds",
        min: 100,
        max: 30_000,
        step: 100,
        default: 1000,
        yamlOnly: true,
      },
      {
        key: "min_brightness",
        label: "Min brightness",
        type: "percent",
        min: 0,
        max: 100,
        step: 1,
        default: 0,
        yamlOnly: true,
      },
      {
        key: "max_brightness",
        label: "Max brightness",
        type: "percent",
        min: 0,
        max: 100,
        step: 1,
        default: 100,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "random",
    name: "Random",
    category: "basic",
    description: "Random colors at fixed intervals",
    params: [
      {
        key: "transition_length_ms",
        label: "Transition",
        type: "milliseconds",
        min: 100,
        max: 30_000,
        step: 100,
        default: 5000,
        yamlOnly: true,
      },
      {
        key: "update_interval_ms",
        label: "Update interval",
        type: "milliseconds",
        min: 100,
        max: 60_000,
        step: 100,
        default: 7000,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "strobe",
    name: "Strobe",
    category: "basic",
    description: "Cycle through configured colors (colors defined in gate YAML)",
    params: [],
  },
  {
    id: "flicker",
    name: "Flicker",
    category: "basic",
    description: "Candle-like brightness variation on the whole strip",
    params: [
      {
        key: "alpha",
        label: "Alpha (smoothing)",
        type: "percent",
        min: 0,
        max: 100,
        step: 1,
        default: 95,
        yamlOnly: true,
      },
      {
        key: "intensity",
        label: "Intensity",
        type: "percent",
        min: 0,
        max: 100,
        step: 0.1,
        default: 1.5,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "addressable_rainbow",
    name: "Rainbow",
    category: "strip",
    description: "Hue sweeps along the strip",
    params: [
      {
        key: "speed",
        label: "Speed",
        type: "int",
        min: 1,
        max: 100,
        step: 1,
        default: 10,
        entityName: "FX Rainbow Speed",
      },
      {
        key: "width",
        label: "Width",
        type: "int",
        min: 1,
        max: 255,
        step: 1,
        default: 50,
        entityName: "FX Rainbow Width",
      },
    ],
  },
  {
    id: "addressable_color_wipe",
    name: "Color Wipe",
    category: "strip",
    description: "New colors shift in at the start of the strip",
    params: [
      {
        key: "add_led_interval_ms",
        label: "LED shift interval",
        type: "milliseconds",
        min: 10,
        max: 5000,
        step: 10,
        default: 100,
        yamlOnly: true,
      },
      {
        key: "reverse",
        label: "Reverse direction",
        type: "bool",
        default: false,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "addressable_scan",
    name: "Scan",
    category: "strip",
    description: "Single dot slides back and forth (uses base color)",
    params: [
      {
        key: "move_interval_ms",
        label: "Move interval",
        type: "milliseconds",
        min: 10,
        max: 5000,
        step: 10,
        default: 100,
        entityName: "FX Scan Interval",
      },
      {
        key: "scan_width",
        label: "Scan width (LEDs)",
        type: "int",
        min: 1,
        max: 60,
        step: 1,
        default: 1,
        entityName: "FX Scan Width",
      },
    ],
  },
  {
    id: "addressable_twinkle",
    name: "Twinkle",
    category: "strip",
    description: "Random pixels brighten and fade (uses base color)",
    params: [
      {
        key: "twinkle_probability",
        label: "Twinkle probability",
        type: "percent",
        min: 0,
        max: 100,
        step: 0.1,
        default: 5,
        yamlOnly: true,
      },
      {
        key: "progress_interval_ms",
        label: "Progress interval",
        type: "milliseconds",
        min: 1,
        max: 100,
        step: 1,
        default: 4,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "addressable_random_twinkle",
    name: "Random Twinkle",
    category: "strip",
    description: "Twinkle with a random color per pixel",
    params: [
      {
        key: "twinkle_probability",
        label: "Twinkle probability",
        type: "percent",
        min: 0,
        max: 100,
        step: 0.1,
        default: 5,
        yamlOnly: true,
      },
      {
        key: "progress_interval_ms",
        label: "Progress interval",
        type: "milliseconds",
        min: 1,
        max: 100,
        step: 1,
        default: 32,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "addressable_fireworks",
    name: "Fireworks",
    category: "strip",
    description: "Sparks burst from random pixels and cascade",
    params: [
      {
        key: "update_interval_ms",
        label: "Update interval",
        type: "milliseconds",
        min: 1,
        max: 200,
        step: 1,
        default: 32,
        yamlOnly: true,
      },
      {
        key: "spark_probability",
        label: "Spark probability",
        type: "percent",
        min: 0,
        max: 100,
        step: 0.1,
        default: 10,
        yamlOnly: true,
      },
      {
        key: "use_random_color",
        label: "Random spark colors",
        type: "bool",
        default: false,
        yamlOnly: true,
      },
      {
        key: "fade_out_rate",
        label: "Fade out rate",
        type: "int",
        min: 1,
        max: 255,
        step: 1,
        default: 120,
        yamlOnly: true,
      },
    ],
  },
  {
    id: "addressable_flicker",
    name: "Addressable Flicker",
    category: "strip",
    description: "Per-pixel flicker around the base color",
    params: [
      {
        key: "update_interval_ms",
        label: "Update interval",
        type: "milliseconds",
        min: 1,
        max: 200,
        step: 1,
        default: 16,
        entityName: "FX Strip Flicker Interval",
      },
      {
        key: "intensity",
        label: "Intensity",
        type: "percent",
        min: 0,
        max: 100,
        step: 0.1,
        default: 5,
        entityName: "FX Strip Flicker Intensity",
      },
    ],
  },
];

export const EFFECT_BY_ID = new Map(EFFECT_CATALOG.map((e) => [e.id, e]));

export const EFFECT_BY_NAME = new Map(EFFECT_CATALOG.map((e) => [e.name, e]));

export function resolveEffectId(effectId?: string, legacyName?: string): string {
  if (effectId && EFFECT_BY_ID.has(effectId)) return effectId;
  if (legacyName) {
    const byName = EFFECT_BY_NAME.get(legacyName);
    if (byName) return byName.id;
    const byId = EFFECT_BY_ID.get(legacyName);
    if (byId) return byId.id;
  }
  return "pulse";
}

export function defaultEffectParams(effectId: string): Record<string, number | boolean> {
  const effect = EFFECT_BY_ID.get(effectId);
  if (!effect) return {};
  return Object.fromEntries(
    effect.params.map((p) => [p.key, p.default]),
  ) as Record<string, number | boolean>;
}

export function mergeEffectParams(
  effectId: string,
  params?: Record<string, number | boolean>,
): Record<string, number | boolean> {
  return { ...defaultEffectParams(effectId), ...params };
}

export function describeEffectAction(
  effectId: string,
  params?: Record<string, number | boolean>,
): string {
  const effect = EFFECT_BY_ID.get(effectId);
  if (!effect) return `effect: ${effectId}`;
  const merged = mergeEffectParams(effectId, params);
  const parts = effect.params
    .filter((p) => merged[p.key] !== p.default)
    .map((p) => `${p.label}=${String(merged[p.key])}`);
  if (parts.length === 0) return `effect: ${effect.name}`;
  return `effect: ${effect.name} (${parts.join(", ")})`;
}
