import type { RaceEventType } from "@/lib/race-events";
import { RACE_EVENT_TYPE_IDS } from "@/lib/race-events";
import type { RaceEvent } from "@/lib/types";

/** Sample pilots for manual routine runs (pilot color / crossing). */
export const testPilots = [
  {
    id: "pilot-1",
    name: "Alpha",
    color: { r: 255, g: 0, b: 0 },
    seat: 1,
  },
  {
    id: "pilot-2",
    name: "Bravo",
    color: { r: 0, g: 128, b: 255 },
    seat: 2,
  },
  {
    id: "pilot-3",
    name: "Charlie",
    color: { r: 0, g: 255, b: 0 },
    seat: 3,
  },
] as const;

export const testHeat = {
  id: "heat-1",
  name: "Round 1 · Heat 3",
  round: 1,
};

const fixtures: Record<RaceEventType, RaceEvent> = {
  "heat.loaded": {
    type: "heat.loaded",
    heat: testHeat,
    pilots: [...testPilots],
  },
  "heat.arm_started": {
    type: "heat.arm_started",
    heat: testHeat,
  },
  "heat.go": {
    type: "heat.go",
    heat: testHeat,
  },
  "heat.finished": {
    type: "heat.finished",
    heat: testHeat,
  },
  "pilot.crossing": {
    type: "pilot.crossing",
    pilot: testPilots[0],
    crossing: { lap: 1, node: "start" },
    heat: testHeat,
  },
};

export function isRaceEventType(value: string): value is RaceEventType {
  return (RACE_EVENT_TYPE_IDS as readonly string[]).includes(value);
}

/** Synthetic race event for manually running a routine from the UI. */
export function createTestRaceEvent(eventType: RaceEventType): RaceEvent {
  return structuredClone(fixtures[eventType]);
}
