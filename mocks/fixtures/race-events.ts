import {
  createTestRaceEvent,
  testHeat,
  testPilots,
} from "../../lib/test-race-event";
import type { RaceEvent } from "../../lib/types";

export const samplePilots = testPilots;
export const sampleHeat = testHeat;

export const raceEventFixtures: Record<string, RaceEvent> = {
  "heat.loaded": createTestRaceEvent("heat.loaded"),
  "heat.arm_started": createTestRaceEvent("heat.arm_started"),
  "heat.go": createTestRaceEvent("heat.go"),
  "heat.finished": createTestRaceEvent("heat.finished"),
  "pilot.crossing": createTestRaceEvent("pilot.crossing"),
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
