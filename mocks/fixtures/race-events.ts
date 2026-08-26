import type { NextWireEvent } from "../../lib/adapters/next-events";
import { rgbToHex } from "../../lib/color";
import { testPilots } from "../../lib/test-race-event";

const EVENT_ID = 133;
const HEAT = 3;

function toNextColor(rgb: { r: number; g: number; b: number }): string {
  return rgbToHex(rgb).replace("#", "").toUpperCase();
}

const arm: NextWireEvent = {
  event: "arm",
  eventId: EVENT_ID,
  heat: HEAT,
};

const start: NextWireEvent = {
  event: "start",
  eventId: EVENT_ID,
  heat: HEAT,
};

const finish: NextWireEvent = {
  event: "finish",
  eventId: EVENT_ID,
  heat: HEAT,
};

const lastcall: NextWireEvent = {
  event: "lastcall",
  eventId: EVENT_ID,
  seconds: 60,
};

function pilotCrossing(pilotIndex: 0 | 1 | 2, lap: number): NextWireEvent {
  const pilot = testPilots[pilotIndex];
  return {
    event: "pilot",
    eventId: EVENT_ID,
    pilotId: Number.parseInt(pilot.id.replace("pilot-", ""), 10),
    pilot: pilot.name,
    color: toNextColor(pilot.color),
    lap,
  };
}

/**
 * Next wire fixtures keyed by Next event name and GateStage internal type
 * (so `POST /emit { "type": "heat.go" }` still works).
 */
export const nextWireFixtures: Record<string, NextWireEvent> = {
  arm,
  "heat.arm_started": arm,
  start,
  "heat.go": start,
  finish,
  "heat.finished": finish,
  lastcall,
  "heat.last_call": lastcall,
  pilot: pilotCrossing(0, 1),
  "pilot.crossing": pilotCrossing(0, 1),
};

/** Typical Next heat: last call → arm → start → crossings → finish. */
export const heatSequence: { event: NextWireEvent; delayMs: number }[] = [
  { event: lastcall, delayMs: 0 },
  { event: arm, delayMs: 2000 },
  { event: start, delayMs: 3000 },
  { event: pilotCrossing(0, 0), delayMs: 500 },
  { event: pilotCrossing(1, 0), delayMs: 800 },
  { event: pilotCrossing(0, 1), delayMs: 4000 },
  { event: finish, delayMs: 2000 },
];
