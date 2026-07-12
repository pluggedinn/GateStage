import { NextResponse } from "next/server";
import { getSequence } from "@/lib/config/store";
import { getRaceBrain } from "@/lib/race-brain";
import { createTestRaceEvent, isRaceEventType } from "@/lib/test-race-event";
import type { RaceEventEnvelope } from "@/lib/types";

type Params = { params: Promise<{ eventType: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { eventType } = await params;

  if (!isRaceEventType(eventType)) {
    return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
  }

  const sequence = getSequence(eventType);
  if (!sequence) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }
  if (sequence.steps.length === 0) {
    return NextResponse.json(
      { error: "Routine has no steps" },
      { status: 400 },
    );
  }

  const event = createTestRaceEvent(eventType);
  const { gateEngine, broadcaster } = getRaceBrain();

  const envelope: RaceEventEnvelope = {
    type: event.type,
    payload: event,
    at: new Date().toISOString(),
  };
  broadcaster.emitRaceEvent(envelope);

  const result = await gateEngine.runRoutine(eventType);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, type: eventType });
}
