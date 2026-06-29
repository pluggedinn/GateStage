/**
 * ESPHome light effects supported by GateStage gate firmware.
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
  /** ESPHome REST entity; omitted when not exposed on the device */
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
  /** When true, UI offers an RGB color sent with turn_on */
  supportsColor?: boolean;
};

export const EFFECT_CATALOG: EffectDef[] = [
  {
    id: "pulse",
    name: "Pulse",
    category: "basic",
    description: "Smooth brightness pulse across the whole strip",
    supportsColor: true,
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
    id: "strobe",
    name: "Strobe",
    category: "basic",
    description: "Flash on and off in a chosen color",
    supportsColor: true,
    params: [],
  },
  {
    id: "addressable_color_wipe",
    name: "Color Wipe",
    category: "strip",
    description: "Sweep a chosen color along the strip",
    supportsColor: true,
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
];

export const EFFECT_BY_ID = new Map(EFFECT_CATALOG.map((e) => [e.id, e]));

export const EFFECT_BY_NAME = new Map(EFFECT_CATALOG.map((e) => [e.name, e]));

export type EffectSelection = {
  effectId: string;
  params: Record<string, number | boolean>;
  r?: number;
  g?: number;
  b?: number;
};

export const DEFAULT_EFFECT_COLOR = { r: 255, g: 255, b: 255 } as const;

export function defaultEffectSelection(effectId: string): EffectSelection {
  const effect = EFFECT_BY_ID.get(effectId);
  const selection: EffectSelection = {
    effectId,
    params: defaultEffectParams(effectId),
  };
  if (effect?.supportsColor) {
    selection.r = DEFAULT_EFFECT_COLOR.r;
    selection.g = DEFAULT_EFFECT_COLOR.g;
    selection.b = DEFAULT_EFFECT_COLOR.b;
  }
  return selection;
}

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
