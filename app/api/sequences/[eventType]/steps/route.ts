import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { validateChoreographyAction } from "@/lib/choreography";
import {
  actionUsesPilotColorSource,
  actionUsesWinnerColorSource,
  eventSupportsPilotColor,
  eventSupportsWinnerColor,
} from "@/lib/color-source";
import { eventSequenceSchema } from "@/lib/config/schema";
import { getSequence, saveConfig } from "@/lib/config/store";
import { logger } from "@/lib/logger";
import { sequenceActionStepSchema, sequenceDelayStepSchema } from "@/lib/types";

type Params = { params: Promise<{ eventType: string }> };

/** Append an action or delay step to the routine for this event type. */
export async function POST(request: Request, { params }: Params) {
  const { eventType } = await params;
  const body = await request.json();

  const parsed =
    body?.kind === "delay"
      ? sequenceDelayStepSchema.omit({ id: true }).safeParse(body)
      : sequenceActionStepSchema.omit({ id: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.kind === "action") {
    if (
      actionUsesPilotColorSource(parsed.data.action) &&
      !eventSupportsPilotColor(eventType)
    ) {
      return NextResponse.json(
        {
          error:
            "Pilot color is only available for heat.finished and pilot.crossing routines",
        },
        { status: 400 },
      );
    }

    if (
      actionUsesWinnerColorSource(parsed.data.action) &&
      !eventSupportsWinnerColor(eventType)
    ) {
      return NextResponse.json(
        {
          error: "Winner color is only available for heat.finished routines",
        },
        { status: 400 },
      );
    }

    if (parsed.data.action.kind === "choreography") {
      const choreographyError = validateChoreographyAction(
        parsed.data.action,
        parsed.data.target,
      );
      if (choreographyError) {
        return NextResponse.json({ error: choreographyError }, { status: 400 });
      }
    }
  }

  const step = { id: randomUUID(), ...parsed.data };
  let updated = getSequence(eventType);

  saveConfig((config) => {
    const sequences = [...config.sequences];
    const index = sequences.findIndex((s) => s.eventType === eventType);

    if (index >= 0) {
      const sequence = eventSequenceSchema.parse({
        ...sequences[index],
        steps: [...sequences[index].steps, step],
      });
      sequences[index] = sequence;
      updated = sequence;
    } else {
      const sequence = eventSequenceSchema.parse({
        id: `seq-${eventType}`,
        eventType,
        enabled: true,
        steps: [step],
      });
      sequences.push(sequence);
      updated = sequence;
    }

    return { ...config, sequences };
  });

  logger.info("routines", `added step to ${eventType}`, step);
  broadcaster.emitConfigUpdated();
  return NextResponse.json({ step, sequence: updated }, { status: 201 });
}
