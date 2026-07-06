import { z } from "zod";
import {
  DEFAULT_BRIGHTNESS_PERCENT,
  resolveBrightnessPercent,
} from "@/lib/brightness";
import { rgbToHex } from "@/lib/color";
import { colorSourceSchema, resolveActionColor } from "@/lib/color-source";
import {
  CHOREOGRAPHY_EASING_OPTIONS,
  type ChoreographyEasing,
  computeInterGateDelays,
} from "../timing";
import type { ChoreographyDef } from "../types";

export const tunnelParamsSchema = z
  .object({
    colorSource: colorSourceSchema.default("fixed"),
    r: z.number().int().min(0).max(255).optional(),
    g: z.number().int().min(0).max(255).optional(),
    b: z.number().int().min(0).max(255).optional(),
    brightnessPercent: z.number().int().min(1).max(100).optional(),
    durationMs: z.number().int().min(100).max(60_000).default(3000),
    easing: z
      .enum(["linear", "easeInQuad", "easeInCubic"])
      .default("easeInQuad"),
  })
  .superRefine((params, ctx) => {
    if (params.colorSource === "fixed") {
      if (params.r === undefined) {
        ctx.addIssue({ code: "custom", message: "r required", path: ["r"] });
      }
      if (params.g === undefined) {
        ctx.addIssue({ code: "custom", message: "g required", path: ["g"] });
      }
      if (params.b === undefined) {
        ctx.addIssue({ code: "custom", message: "b required", path: ["b"] });
      }
    }
  });

export type TunnelParams = z.infer<typeof tunnelParamsSchema>;

export const tunnelChoreography: ChoreographyDef<TunnelParams> = {
  id: "tunnel",
  label: "Tunnel",
  description:
    "Sequential color wave through all gates in track order (slow → fast)",
  requiresTarget: "all",
  paramsSchema: tunnelParamsSchema,
  defaultParams: () => ({
    colorSource: "fixed",
    r: 255,
    g: 0,
    b: 0,
    brightnessPercent: DEFAULT_BRIGHTNESS_PERCENT,
    durationMs: 3000,
    easing: "easeInQuad",
  }),
  async run(ctx, params) {
    const rgb = resolveActionColor(params, ctx.event);
    if (!rgb) return;

    const brightnessPercent = resolveBrightnessPercent(
      { brightnessPercent: params.brightnessPercent },
      DEFAULT_BRIGHTNESS_PERCENT,
    );
    const delays = computeInterGateDelays(
      ctx.gates.length,
      params.durationMs,
      params.easing as ChoreographyEasing,
    );

    for (let i = 0; i < ctx.gates.length; i++) {
      if (i > 0) await ctx.sleep(delays[i - 1] ?? 0);

      const gate = ctx.gates[i];
      const commandLabel = `tunnel ${rgbToHex(rgb)} @ ${brightnessPercent}%`;
      await ctx.sendToGate(
        gate,
        {
          kind: "rgb",
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          brightnessPercent,
        },
        commandLabel,
      );
    }
  },
  describe(params) {
    const brightnessPercent = resolveBrightnessPercent(
      { brightnessPercent: params.brightnessPercent },
      DEFAULT_BRIGHTNESS_PERCENT,
    );
    const seconds = params.durationMs / 1000;
    const easingLabel =
      CHOREOGRAPHY_EASING_OPTIONS.find((o) => o.value === params.easing)
        ?.label ?? params.easing;
    const colorLabel =
      params.colorSource === "pilot"
        ? "Pilot color"
        : rgbToHex({
            r: params.r ?? 0,
            g: params.g ?? 0,
            b: params.b ?? 0,
          });
    return `Tunnel ${colorLabel} @ ${brightnessPercent}% · ${seconds}s · ${easingLabel}`;
  },
};
