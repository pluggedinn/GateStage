import { z } from "zod";
import { type Rgb, rgbToHex } from "@/lib/color";
import { resolvePilotColor } from "@/lib/heat-state";
import type { RaceEvent } from "@/lib/types";

export const colorSourceSchema = z.enum(["fixed", "pilot"]);

export type ColorSource = z.infer<typeof colorSourceSchema>;

export const PILOT_COLOR_EVENT_TYPES = [
  "heat.finished",
  "pilot.crossing",
] as const;

export type PilotColorEventType = (typeof PILOT_COLOR_EVENT_TYPES)[number];

export function eventSupportsPilotColor(eventType: string): boolean {
  return (PILOT_COLOR_EVENT_TYPES as readonly string[]).includes(eventType);
}

export type ActionColorFields = {
  colorSource?: ColorSource;
  r?: number;
  g?: number;
  b?: number;
};

export function isPilotColorSource(colorSource?: ColorSource): boolean {
  return colorSource === "pilot";
}

export function describeColorSource(
  colorSource?: ColorSource,
  rgb?: Rgb,
): string {
  if (isPilotColorSource(colorSource)) return "Pilot color";
  if (
    rgb &&
    rgb.r !== undefined &&
    rgb.g !== undefined &&
    rgb.b !== undefined
  ) {
    return rgbToHex(rgb);
  }
  return "Color";
}

export function resolveActionColor(
  fields: ActionColorFields,
  event: RaceEvent,
): { r: number; g: number; b: number } | null {
  if (isPilotColorSource(fields.colorSource)) {
    return resolvePilotColor(event);
  }

  if (
    fields.r !== undefined &&
    fields.g !== undefined &&
    fields.b !== undefined
  ) {
    return { r: fields.r, g: fields.g, b: fields.b };
  }

  return null;
}

export function actionUsesPilotColorSource(action: {
  kind: string;
  colorSource?: ColorSource;
  params?: Record<string, unknown>;
}): boolean {
  if (action.kind === "pilot_color") return true;
  if (action.colorSource === "pilot") return true;
  if (
    action.kind === "choreography" &&
    action.params?.colorSource === "pilot"
  ) {
    return true;
  }
  return false;
}
