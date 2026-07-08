import type { RaceEvent } from "@/lib/types";

export type RaceEventType = RaceEvent["type"];

export type RaceEventDef = {
  id: RaceEventType;
  label: string;
  description: string;
};

export const RACE_EVENT_TYPES: readonly RaceEventDef[] = [
  {
    id: "heat.loaded",
    label: "Heat loaded",
    description: "Pilots and heat info received from your race manager",
  },
  {
    id: "heat.arm_started",
    label: "Arm started",
    description: "Countdown is arming before the heat",
  },
  {
    id: "heat.go",
    label: "Heat go",
    description: "Race start signal",
  },
  {
    id: "heat.finished",
    label: "Heat finished",
    description: "Heat completed",
  },
  {
    id: "pilot.crossing",
    label: "Pilot crossing",
    description: "A pilot crossed the timing gate",
  },
] as const;

export const RACE_EVENT_TYPE_IDS = RACE_EVENT_TYPES.map((e) => e.id);

export function getRaceEventDef(eventType: string): RaceEventDef | undefined {
  return RACE_EVENT_TYPES.find((e) => e.id === eventType);
}
