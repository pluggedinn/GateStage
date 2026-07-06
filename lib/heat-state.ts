import type { Pilot, RaceEvent } from "@/lib/types";

let heatPilots: Pilot[] = [];
let lastCrossingPilot: Pilot | null = null;

export function ingestRaceEvent(event: RaceEvent) {
  if (event.type === "heat.loaded") {
    heatPilots = event.pilots;
    lastCrossingPilot = null;
    return;
  }

  if (event.type === "pilot.crossing") {
    lastCrossingPilot = event.pilot;
  }
}

/** Pilot color for heat.finished — last finisher, else first loaded pilot. */
export function resolveHeatFinishedPilot(): Pilot | null {
  return lastCrossingPilot ?? heatPilots[0] ?? null;
}

export function resolvePilotColor(
  event: RaceEvent,
): { r: number; g: number; b: number } | null {
  if (event.type === "pilot.crossing") {
    return event.pilot.color;
  }

  if (event.type === "heat.loaded" && event.pilots[0]) {
    return event.pilots[0].color;
  }

  if (event.type === "heat.finished") {
    const pilot = resolveHeatFinishedPilot();
    return pilot?.color ?? null;
  }

  return null;
}
