import { z } from "zod";
import { hexToRgb } from "@/lib/color";
import { type HeatInfo, type RaceEvent, raceEventSchema } from "@/lib/types";

/**
 * Next race director WebSocket wire format (port 5702).
 *
 * @see https://go-next.co/ — raw RFC 6455 JSON messages, no auth.
 */
export const nextWireEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("arm"),
    eventId: z.number(),
    heat: z.number(),
  }),
  z.object({
    event: z.literal("start"),
    eventId: z.number(),
    heat: z.number(),
  }),
  z.object({
    event: z.literal("finish"),
    eventId: z.number(),
    heat: z.number(),
  }),
  z.object({
    event: z.literal("lastcall"),
    eventId: z.number(),
    seconds: z.number(),
  }),
  z.object({
    event: z.literal("pilot"),
    eventId: z.number(),
    pilotId: z.number(),
    pilot: z.string(),
    color: z.string(),
    lap: z.number(),
  }),
]);

export type NextWireEvent = z.infer<typeof nextWireEventSchema>;

function heatFromNext(heatNumber: number): HeatInfo {
  return {
    id: String(heatNumber),
    name: `Heat ${heatNumber}`,
  };
}

function translateNextWire(wire: NextWireEvent): RaceEvent {
  switch (wire.event) {
    case "arm":
      return { type: "heat.arm_started", heat: heatFromNext(wire.heat) };
    case "start":
      return { type: "heat.go", heat: heatFromNext(wire.heat) };
    case "finish":
      return { type: "heat.finished", heat: heatFromNext(wire.heat) };
    case "lastcall":
      return {
        type: "heat.last_call",
        seconds: wire.seconds,
        heat: { id: String(wire.eventId) },
      };
    case "pilot":
      return {
        type: "pilot.crossing",
        pilot: {
          id: String(wire.pilotId),
          name: wire.pilot,
          color: hexToRgb(wire.color),
        },
        crossing: { lap: wire.lap },
        heat: { id: String(wire.eventId) },
      };
  }
}

/**
 * Turn a parsed Next WebSocket payload into an internal {@link RaceEvent}.
 *
 * Prefers the documented Next wire format, then falls back to an already
 * normalized GateStage event (mock leftovers / older payloads).
 */
export function translateNextMessage(parsed: unknown): RaceEvent | null {
  const wire = nextWireEventSchema.safeParse(parsed);
  if (wire.success) return translateNextWire(wire.data);

  const internal = raceEventSchema.safeParse(parsed);
  if (internal.success) return internal.data;

  return null;
}
