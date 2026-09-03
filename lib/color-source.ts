import { z } from "zod";
import { type Rgb, rgbToHex } from "@/lib/color";
import { resolvePilotColor, resolveWinnerColor } from "@/lib/heat-state";
import type { RaceEvent } from "@/lib/types";

export const colorSourceSchema = z.enum(["fixed", "pilot", "winner"]);

export type ColorSource = z.infer<typeof colorSourceSchema>;

export const PILOT_COLOR_EVENT_TYPES = [
  "heat.finished",
  "pilot.crossing",
] as const;

export const WINNER_COLOR_EVENT_TYPES = ["heat.finished"] as const;

export type PilotColorEventType = (typeof PILOT_COLOR_EVENT_TYPES)[number];

export function eventSupportsPilotColor(eventType: string): boolean {
  return (PILOT_COLOR_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function eventSupportsWinnerColor(eventType: string): boolean {
  return (WINNER_COLOR_EVENT_TYPES as readonly string[]).includes(eventType);
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

export function isWinnerColorSource(colorSource?: ColorSource): boolean {
  return colorSource === "winner";
}

export function isDynamicColorSource(colorSource?: ColorSource): boolean {
  return isPilotColorSource(colorSource) || isWinnerColorSource(colorSource);
}

export function describeColorSource(
  colorSource?: ColorSource,
  rgb?: Rgb,
): string {
  if (isWinnerColorSource(colorSource)) return "Winner color";
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
  if (isWinnerColorSource(fields.colorSource)) {
    return resolveWinnerColor();
  }

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

type ColorSourceAction = {
  kind: string;
  colorSource?: ColorSource;
  params?: Record<string, unknown>;
};

function actionColorSource(action: ColorSourceAction): ColorSource | undefined {
  if (action.kind === "pilot_color") return "pilot";
  if (action.colorSource) return action.colorSource;
  if (
    action.kind === "choreography" &&
    (action.params?.colorSource === "pilot" ||
      action.params?.colorSource === "winner")
  ) {
    return action.params.colorSource;
  }
  return undefined;
}

export function actionUsesPilotColorSource(action: ColorSourceAction): boolean {
  return actionColorSource(action) === "pilot";
}

export function actionUsesWinnerColorSource(
  action: ColorSourceAction,
): boolean {
  return actionColorSource(action) === "winner";
}
