import type { MappingTarget, SequenceActionStep } from "@/lib/types";
import { CHOREOGRAPHY_CATALOG } from "./choreographies";
import type {
  ChoreographyAction,
  ChoreographyContext,
  ChoreographyDef,
  ChoreographyWizardOption,
} from "./types";

export { CHOREOGRAPHY_CATALOG } from "./choreographies";

export type ChoreographyId = (typeof CHOREOGRAPHY_CATALOG)[number]["id"];

const CHOREOGRAPHY_BY_ID = new Map<string, ChoreographyDef<unknown>>(
  CHOREOGRAPHY_CATALOG.map((def) => [def.id, def as ChoreographyDef<unknown>]),
);

export function getChoreography(
  id: string,
): ChoreographyDef<unknown> | undefined {
  return CHOREOGRAPHY_BY_ID.get(id);
}

export function choreographyRequiresAllGates(id: string): boolean {
  const def = CHOREOGRAPHY_BY_ID.get(id);
  return def?.requiresTarget === "all";
}

export function parseChoreographyParams<T>(
  def: ChoreographyDef<T>,
  params: Record<string, number | boolean | string> | undefined,
): { ok: true; data: T } | { ok: false; error: string } {
  const merged = {
    ...def.defaultParams(),
    ...params,
  };
  const parsed = def.paramsSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid params",
    };
  }
  return { ok: true, data: parsed.data };
}

export function validateChoreographyAction(
  action: ChoreographyAction,
  target: MappingTarget,
): string | null {
  if (target !== "all") {
    return "Choreography steps require target All gates";
  }

  const def = getChoreography(action.choreographyId);
  if (!def) {
    return `Unknown choreography: ${action.choreographyId}`;
  }

  const parsed = parseChoreographyParams(def, action.params);
  if (!parsed.ok) return parsed.error;
  return null;
}

export function validateSequenceActionStep(
  step: SequenceActionStep,
): string | null {
  if (step.action.kind !== "choreography") return null;
  return validateChoreographyAction(step.action, step.target);
}

export async function runChoreography(
  action: ChoreographyAction,
  ctx: ChoreographyContext,
): Promise<void> {
  const def = getChoreography(action.choreographyId);
  if (!def) {
    throw new Error(`Unknown choreography: ${action.choreographyId}`);
  }

  const parsed = parseChoreographyParams(def, action.params);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  await def.run(ctx, parsed.data);
}

export function describeChoreographyAction(action: ChoreographyAction): string {
  const def = getChoreography(action.choreographyId);
  if (!def) return `choreography: ${action.choreographyId}`;

  const parsed = parseChoreographyParams(def, action.params);
  if (!parsed.ok) return `choreography: ${action.choreographyId}`;
  return def.describe(parsed.data);
}

export function getChoreographyWizardOptions(): ChoreographyWizardOption[] {
  return CHOREOGRAPHY_CATALOG.map((def) => ({
    actionKind: `choreography:${def.id}` as const,
    label: def.label,
    description: def.description,
    requiresAllGates: true,
  }));
}

export function isChoreographyActionKind(
  actionKind: string,
): actionKind is `choreography:${string}` {
  return actionKind.startsWith("choreography:");
}

export function choreographyIdFromActionKind(
  actionKind: `choreography:${string}`,
): string {
  return actionKind.slice("choreography:".length);
}

export function defaultChoreographyParams(
  choreographyId: string,
): Record<string, number | boolean | string> {
  const def = getChoreography(choreographyId);
  if (!def) return {};
  return def.defaultParams() as Record<string, number | boolean | string>;
}

export type { ChoreographyEasing } from "./timing";
export {
  CHOREOGRAPHY_EASING_OPTIONS,
  computeInterGateDelays,
} from "./timing";
