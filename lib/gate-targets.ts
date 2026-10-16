import type { Gate } from "@/lib/config/schema";

/** Routine target and Manual path for every enabled gate that is not the start gate. */
export const ALL_EXCEPT_START_TARGET = "all_except_start";

export const ALL_EXCEPT_START_LABEL = "All gates except for start gate";

export function gatesExceptStart(gates: Gate[]): Gate[] {
  return gates.filter((gate) => gate.enabled && !gate.isStartGate);
}
