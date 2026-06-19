import type { RaceEvent } from "../../lib/types";

export const samplePilots = [
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

export const sampleHeat = {
  id: "heat-1",
  name: "Round 1 · Heat 3",
  round: 1,
};

export const raceEventFixtures: Record<string, RaceEvent> = {
  "heat.loaded": {
    type: "heat.loaded",
    heat: sampleHeat,
    pilots: [...samplePilots],
  },
  "heat.arm_started": {
    type: "heat.arm_started",
    heat: sampleHeat,
  },
  "heat.go": {
    type: "heat.go",
    heat: sampleHeat,
  },
  "heat.finished": {
    type: "heat.finished",
    heat: sampleHeat,
  },
  "pilot.crossing": {
    type: "pilot.crossing",
    pilot: samplePilots[0],
    crossing: { lap: 1, node: "start" },
    heat: sampleHeat,
  },
};

/** Typical race sequence with delays in ms between events */
export const heatSequence: { event: RaceEvent; delayMs: number }[] = [
  { event: raceEventFixtures["heat.loaded"], delayMs: 0 },
  { event: raceEventFixtures["heat.arm_started"], delayMs: 2000 },
  { event: raceEventFixtures["heat.go"], delayMs: 3000 },
  {
    event: {
      type: "pilot.crossing",
      pilot: samplePilots[0],
      crossing: { lap: 0, node: "start" },
      heat: sampleHeat,
    },
    delayMs: 500,
  },
  {
    event: {
      type: "pilot.crossing",
      pilot: samplePilots[1],
      crossing: { lap: 0, node: "start" },
      heat: sampleHeat,
    },
    delayMs: 800,
  },
  {
    event: {
      type: "pilot.crossing",
      pilot: samplePilots[0],
      crossing: { lap: 1, node: "finish" },
      heat: sampleHeat,
    },
    delayMs: 4000,
  },
  { event: raceEventFixtures["heat.finished"], delayMs: 2000 },
];
