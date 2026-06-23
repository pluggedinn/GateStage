export type Rgb = { r: number; g: number; b: number };

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.slice(0, 6);
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** Parse `rgb(r,g,b)` from gate action command labels (see gate-engine describeCommand). */
export function parseRgbFromCommand(command: string): Rgb | null {
  const match = command.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

/** Scale RGB channels as ESPHome brightness would (0–100%). */
export function applyBrightnessToRgb(rgb: Rgb, brightnessPercent: number): Rgb {
  const scale = Math.min(100, Math.max(0, brightnessPercent)) / 100;
  return {
    r: clampChannel(rgb.r * scale),
    g: clampChannel(rgb.g * scale),
    b: clampChannel(rgb.b * scale),
  };
}
