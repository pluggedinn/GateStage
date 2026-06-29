import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { eventSequenceSchema } from "@/lib/config/schema";
import { getSequence, saveConfig } from "@/lib/config/store";

type Params = {
  params: Promise<{ eventType: string; stepId: string }>;
};

export async function DELETE(_request: Request, { params }: Params) {
  const { eventType, stepId } = await params;
  const existing = getSequence(eventType);

  if (!existing) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  if (!existing.steps.some((s) => s.id === stepId)) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  let updated = existing;
  saveConfig((config) => ({
    ...config,
    sequences: config.sequences.map((sequence) => {
      if (sequence.eventType !== eventType) return sequence;
      updated = eventSequenceSchema.parse({
        ...sequence,
        steps: sequence.steps.filter((s) => s.id !== stepId),
      });
      return updated;
    }),
  }));

  broadcaster.emitConfigUpdated();
  return NextResponse.json(updated);
}
