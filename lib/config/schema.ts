import { z } from "zod";
import { mappingActionSchema } from "@/lib/types";

export const gateSchema = z.object({
  id: z.string().min(1),
  host: z.string().min(1),
  isStartGate: z.boolean().default(false),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const eventMappingSchema = z.object({
  id: z.string(),
  eventType: z.string().min(1),
  target: z.enum(["all", "start_gate", "gate_id"]),
  targetGateId: z.string().nullable().default(null),
  action: mappingActionSchema,
  enabled: z.boolean().default(true),
});

export const settingsSchema = z.object({
  nextWsUrl: z.string().min(1),
  /** 1–100%; typical race strips run around 5% */
  defaultBrightnessPercent: z.number().int().min(1).max(100).default(5),
});

export const configSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  gates: z.array(gateSchema),
  mappings: z.array(eventMappingSchema),
});

export type Gate = z.infer<typeof gateSchema>;
export type EventMapping = z.infer<typeof eventMappingSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Config = z.infer<typeof configSchema>;
