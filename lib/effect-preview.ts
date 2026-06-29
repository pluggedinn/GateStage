/**
 * ESPHome light effect preview types.
 * @see https://github.com/esphome/esphome-docs/blob/current/src/components/LightEffectPreview.astro
 */
export type EffectPreviewType = "pulse" | "strobe" | "rainbow" | "color-wipe";

export const EFFECT_PREVIEW_BY_ID: Record<string, EffectPreviewType> = {
  pulse: "pulse",
  strobe: "strobe",
  addressable_rainbow: "rainbow",
  addressable_color_wipe: "color-wipe",
};
