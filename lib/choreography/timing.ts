export type ChoreographyEasing = "linear" | "easeInQuad" | "easeInCubic";

const easingFns: Record<ChoreographyEasing, (t: number) => number> = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeInCubic: (t) => t * t * t,
};

/** Milliseconds to wait before firing each gate after the first (length n - 1). */
export function computeInterGateDelays(
  gateCount: number,
  durationMs: number,
  easing: ChoreographyEasing,
): number[] {
  if (gateCount <= 1) return [];

  const ease = easingFns[easing];
  const fireTimes = Array.from({ length: gateCount }, (_, i) => {
    const t = i / (gateCount - 1);
    return durationMs * ease(t);
  });

  return fireTimes.slice(1).map((time, i) => time - fireTimes[i]);
}

export const CHOREOGRAPHY_EASING_OPTIONS: {
  value: ChoreographyEasing;
  label: string;
}[] = [
  { value: "linear", label: "Linear" },
  { value: "easeInQuad", label: "Slow start (quadratic)" },
  { value: "easeInCubic", label: "Slow start (cubic)" },
];
