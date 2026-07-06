import { tunnelChoreography } from "./tunnel";

/** Register new choreographies here — one file per effect in this folder. */
export const CHOREOGRAPHY_CATALOG = [tunnelChoreography] as const;

export type { TunnelParams } from "./tunnel";
export { tunnelChoreography, tunnelParamsSchema } from "./tunnel";
