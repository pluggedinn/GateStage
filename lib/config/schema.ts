import { z } from "zod";
import { INTEGRATION_IDS } from "@/lib/integrations";
import { sequenceStepSchema } from "@/lib/types";

export const gateSchema = z.object({
  id: z.string().min(1),
  host: z.string().min(1),
  isStartGate: z.boolean().default(false),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const eventSequenceSchema = z.object({
  id: z.string(),
  eventType: z.string().min(1),
  enabled: z.boolean().default(true),
  steps: z.array(sequenceStepSchema),
});

export const settingsSchema = z.object({
  raceManagerProvider: z.enum(INTEGRATION_IDS).default("next"),
  nextWsUrl: z.string().min(1),
  /** RotorHazard server (Socket.io); used when raceManagerProvider is rotorhazard */
  rotorHazardUrl: z.string().min(1).default("http://rotorhazard.local:5000"),
  /** 1–100%; typical race strips run around 5% */
  defaultBrightnessPercent: z.number().int().min(1).max(100).default(5),
});

/** PATCH body — optional fields only, no defaults (avoids clobbering unrelated settings). */
export const settingsPatchSchema = z.object({
  raceManagerProvider: z.enum(INTEGRATION_IDS).optional(),
  nextWsUrl: z.string().min(1).optional(),
  rotorHazardUrl: z.string().min(1).optional(),
  defaultBrightnessPercent: z.number().int().min(1).max(100).optional(),
});

export const configSchema = z.object({
  version: z.literal(2),
  settings: settingsSchema,
  gates: z.array(gateSchema),
  sequences: z.array(eventSequenceSchema),
});

export type Gate = z.infer<typeof gateSchema>;
export type EventSequence = z.infer<typeof eventSequenceSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Config = z.infer<typeof configSchema>;

export type { SequenceStep } from "@/lib/types";
