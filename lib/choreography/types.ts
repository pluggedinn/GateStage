import type { z } from "zod";
import type { Gate } from "@/lib/config/schema";
import type { EsphomeCommand } from "@/lib/esphome";
import type { RaceEvent } from "@/lib/types";

export type ChoreographyTarget = "all";

export type ChoreographySendResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export type ChoreographyContext = {
  gates: Gate[];
  event: RaceEvent;
  sleep: (ms: number) => Promise<void>;
  sendToGate: (
    gate: Gate,
    command: EsphomeCommand,
    commandLabel: string,
  ) => Promise<ChoreographySendResult>;
};

export type ChoreographyDef<TParams> = {
  id: string;
  label: string;
  description: string;
  requiresTarget: ChoreographyTarget;
  paramsSchema: z.ZodType<TParams>;
  defaultParams: () => TParams;
  run: (ctx: ChoreographyContext, params: TParams) => Promise<void>;
  describe: (params: TParams) => string;
};

export type ChoreographyAction = {
  kind: "choreography";
  choreographyId: string;
  params: Record<string, number | boolean | string>;
};

export type ChoreographyWizardOption = {
  actionKind: `choreography:${string}`;
  label: string;
  description: string;
  requiresAllGates: true;
};
