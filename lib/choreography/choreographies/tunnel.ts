import { z } from "zod";
import {
  DEFAULT_BRIGHTNESS_PERCENT,
  resolveBrightnessPercent,
} from "@/lib/brightness";
import { rgbToHex } from "@/lib/color";
import { colorSourceSchema, resolveActionColor } from "@/lib/color-source";
import {
  computeTunnelSchedule,
  DEFAULT_STAGGER_MS,
  resolveTunnelStaggerMs,
} from "../timing";
import type { ChoreographyDef } from "../types";

export const tunnelParamsSchema = z
  .object({
    colorSource: colorSourceSchema.default("fixed"),
    r: z.number().int().min(0).max(255).optional(),
    g: z.number().int().min(0).max(255).optional(),
    b: z.number().int().min(0).max(255).optional(),
    brightnessPercent: z.number().int().min(1).max(100).optional(),
    staggerMs: z.number().int().min(20).max(10_000).optional(),
    onMs: z.number().int().min(10).max(60_000).optional(),
    durationMs: z.number().int().min(100).max(60_000).optional(),
    easing: z.string().optional(),
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
  description: "Looping color chase through all gates in track order",
  requiresTarget: "all",
  paramsSchema: tunnelParamsSchema,
  defaultParams: () => ({
    colorSource: "fixed",
    r: 255,
    g: 0,
    b: 0,
    brightnessPercent: DEFAULT_BRIGHTNESS_PERCENT,
  }),
  async run(ctx, params) {
    const rgb = resolveActionColor(params, ctx.event);
    if (!rgb) return;

    const brightnessPercent = resolveBrightnessPercent(
      { brightnessPercent: params.brightnessPercent },
      DEFAULT_BRIGHTNESS_PERCENT,
    );
    const staggerMs = resolveTunnelStaggerMs({
      staggerMs: params.staggerMs,
      durationMs: params.durationMs,
      gateCount: ctx.gates.length,
    });
    const schedule = computeTunnelSchedule({
      gateCount: ctx.gates.length,
      staggerMs,
      onMs: params.onMs,
      rttMs: ctx.gates.map((gate) => ctx.rttMsForGate(gate.id)),
    });

    await Promise.allSettled(
      ctx.gates.map((gate, i) => {
        const startDelayMs = schedule.startDelaysMs[i] ?? 0;
        const commandLabel = `tunnel ${rgbToHex(rgb)} @ ${brightnessPercent}% delay=${startDelayMs}ms`;
        return ctx.sendToGate(
          gate,
          {
            kind: "effect",
            effectId: "strobe",
            params: {
              period_ms: schedule.periodMs,
              on_ms: schedule.onMs,
              start_delay_ms: startDelayMs,
            },
            brightnessPercent,
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
          },
          commandLabel,
        );
      }),
    );
  },
  describe(params) {
    const brightnessPercent = resolveBrightnessPercent(
      { brightnessPercent: params.brightnessPercent },
      DEFAULT_BRIGHTNESS_PERCENT,
    );
    const staggerMs = params.staggerMs ?? DEFAULT_STAGGER_MS;
    const onMs = params.onMs ?? staggerMs;
    const colorLabel =
      params.colorSource === "pilot"
        ? "Pilot color"
        : rgbToHex({
            r: params.r ?? 0,
            g: params.g ?? 0,
            b: params.b ?? 0,
          });
    return `Tunnel ${colorLabel} @ ${brightnessPercent}% · ${staggerMs}ms stagger · ${onMs}ms pulse`;
  },
};
