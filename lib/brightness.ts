/** Typical race-day strip level (~5% of 12V strip max). */
export const DEFAULT_BRIGHTNESS_PERCENT = 5;

export function percentToEsphome(percent: number): number {
  const clamped = Math.min(100, Math.max(1, percent));
  return Math.round((clamped / 100) * 255);
}

export function esphomeToPercent(value: number): number {
  return Math.round((value / 255) * 100);
}

export function resolveBrightnessPercent(
  action?: { brightness?: number; brightnessPercent?: number },
  fallback = DEFAULT_BRIGHTNESS_PERCENT,
): number {
  if (action?.brightnessPercent !== undefined) return action.brightnessPercent;
  if (action?.brightness !== undefined) return esphomeToPercent(action.brightness);
  return fallback;
}
