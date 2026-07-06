import { z } from "zod";
import { colorSourceSchema } from "@/lib/color-source";

export const pilotColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const pilotSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: pilotColorSchema,
  seat: z.number().int().optional(),
});

export const heatInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  round: z.number().int().optional(),
});

export const crossingInfoSchema = z.object({
  lap: z.number().int(),
  timestamp: z.number().optional(),
  node: z.string().optional(),
});

export const raceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heat.loaded"),
    heat: heatInfoSchema,
    pilots: z.array(pilotSchema),
  }),
  z.object({
    type: z.literal("heat.arm_started"),
    heat: heatInfoSchema,
  }),
  z.object({
    type: z.literal("heat.go"),
    heat: heatInfoSchema,
  }),
  z.object({
    type: z.literal("heat.finished"),
    heat: heatInfoSchema,
  }),
  z.object({
    type: z.literal("pilot.crossing"),
    pilot: pilotSchema,
    crossing: crossingInfoSchema,
    heat: heatInfoSchema.optional(),
  }),
]);

export type RaceEvent = z.infer<typeof raceEventSchema>;
export type Pilot = z.infer<typeof pilotSchema>;
export type HeatInfo = z.infer<typeof heatInfoSchema>;

export const mappingTargetSchema = z.enum(["all", "start_gate", "gate_id"]);

export const mappingActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("effect"),
    effectId: z.string().optional(),
    /** @deprecated use effectId */
    name: z.string().optional(),
    params: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
    brightnessPercent: z.number().int().min(1).max(100).optional(),
    colorSource: colorSourceSchema.optional(),
    r: z.number().int().min(0).max(255).optional(),
    g: z.number().int().min(0).max(255).optional(),
    b: z.number().int().min(0).max(255).optional(),
  }),
  z.object({
    kind: z.literal("pilot_color"),
    brightnessPercent: z.number().int().min(1).max(100).optional(),
  }),
  z.object({
    kind: z.literal("solid"),
    colorSource: colorSourceSchema.default("fixed"),
    r: z.number().int().min(0).max(255).optional(),
    g: z.number().int().min(0).max(255).optional(),
    b: z.number().int().min(0).max(255).optional(),
    /** @deprecated use brightnessPercent */
    brightness: z.number().int().optional(),
    brightnessPercent: z.number().int().min(1).max(100).optional(),
  }),
  z.object({ kind: z.literal("off") }),
  z.object({
    kind: z.literal("choreography"),
    choreographyId: z.string().min(1),
    params: z
      .record(z.string(), z.union([z.number(), z.boolean(), z.string()]))
      .default({}),
  }),
]);

export type MappingAction = z.infer<typeof mappingActionSchema>;
export type MappingTarget = z.infer<typeof mappingTargetSchema>;

export const sequenceActionStepSchema = z.object({
  id: z.string(),
  kind: z.literal("action"),
  target: mappingTargetSchema,
  targetGateId: z.string().nullable().default(null),
  action: mappingActionSchema,
});

export const sequenceDelayStepSchema = z.object({
  id: z.string(),
  kind: z.literal("delay"),
  ms: z.number().int().min(0).max(600_000),
});

export const sequenceStepSchema = z.discriminatedUnion("kind", [
  sequenceActionStepSchema,
  sequenceDelayStepSchema,
]);

export type SequenceStep = z.infer<typeof sequenceStepSchema>;
export type SequenceActionStep = z.infer<typeof sequenceActionStepSchema>;
export type SequenceDelayStep = z.infer<typeof sequenceDelayStepSchema>;

export type RaceEventEnvelope = {
  type: RaceEvent["type"];
  payload: RaceEvent;
  at: string;
};

export type RaceActionEnvelope = {
  gateId: string;
  command: string;
  success: boolean;
  error?: string;
  at: string;
};
