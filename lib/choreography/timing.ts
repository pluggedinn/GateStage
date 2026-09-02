export const TUNNEL_LEAD_MS = 250;
export const DEFAULT_STAGGER_MS = 80;
export const MIN_STAGGER_MS = 20;

export function resolveTunnelStaggerMs(options: {
  staggerMs?: number;
  durationMs?: number;
  gateCount: number;
}): number {
  if (
    typeof options.staggerMs === "number" &&
    Number.isFinite(options.staggerMs)
  ) {
    return Math.max(MIN_STAGGER_MS, Math.round(options.staggerMs));
  }
  if (
    typeof options.durationMs === "number" &&
    Number.isFinite(options.durationMs) &&
    options.gateCount > 0
  ) {
    return Math.max(
      MIN_STAGGER_MS,
      Math.round(options.durationMs / options.gateCount),
    );
  }
  return DEFAULT_STAGGER_MS;
}

export function computeTunnelSchedule(options: {
  gateCount: number;
  staggerMs: number;
  onMs?: number;
  leadMs?: number;
  rttMs?: Array<number | null | undefined>;
}): {
  periodMs: number;
  onMs: number;
  startDelaysMs: number[];
} {
  const n = Math.max(0, options.gateCount);
  const stagger = Math.max(MIN_STAGGER_MS, Math.round(options.staggerMs));
  const periodMs = Math.max(stagger, n * stagger);
  const onMs = Math.max(
    1,
    Math.round(options.onMs !== undefined ? options.onMs : stagger),
  );
  const leadMs = options.leadMs ?? TUNNEL_LEAD_MS;
  const startDelaysMs = Array.from({ length: n }, (_, i) => {
    const rtt = options.rttMs?.[i];
    const oneWay =
      typeof rtt === "number" && Number.isFinite(rtt) ? rtt / 2 : 0;
    return Math.max(0, Math.round(leadMs + i * stagger - oneWay));
  });
  return { periodMs, onMs, startDelaysMs };
}
