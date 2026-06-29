import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { eventSequenceSchema } from "@/lib/config/schema";
import { getSequence, saveConfig } from "@/lib/config/store";
import { sequenceActionStepSchema, sequenceDelayStepSchema } from "@/lib/types";

type Params = { params: Promise<{ eventType: string }> };

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

  broadcaster.emitConfigUpdated();
  return NextResponse.json({ step, sequence: updated }, { status: 201 });
}
