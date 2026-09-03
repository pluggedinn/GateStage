import type { Pilot, RaceEvent } from "@/lib/types";

/** First crossing at or above this lap number is the heat winner. */
export const WINNER_MIN_LAPS = 3;

let heatPilots: Pilot[] = [];
let lastCrossingPilot: Pilot | null = null;
let winnerPilot: Pilot | null = null;

function resetHeatProgress() {
  lastCrossingPilot = null;
  winnerPilot = null;
}

export function ingestRaceEvent(event: RaceEvent) {
  if (event.type === "heat.loaded") {
    heatPilots = event.pilots;
    resetHeatProgress();
    return;
  }

  if (event.type === "heat.arm_started" || event.type === "heat.go") {
    resetHeatProgress();
    return;
  }

  if (event.type === "pilot.crossing") {
    lastCrossingPilot = event.pilot;
    if (!winnerPilot && event.crossing.lap >= WINNER_MIN_LAPS) {
      winnerPilot = event.pilot;
    }
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

/** First pilot this heat to complete {@link WINNER_MIN_LAPS} laps. */
export function resolveWinnerColor(): {
  r: number;
  g: number;
  b: number;
} | null {
  return winnerPilot?.color ?? null;
}

/** Test helper — heat-state is process-wide. */
export function resetHeatState() {
  heatPilots = [];
  resetHeatProgress();
}
