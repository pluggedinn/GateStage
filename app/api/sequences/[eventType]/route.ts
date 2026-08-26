import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { eventSequenceSchema } from "@/lib/config/schema";
import { getSequence, saveConfig } from "@/lib/config/store";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ eventType: string }> };

/** Enable or disable the routine for a race event type. */
export async function PATCH(request: Request, { params }: Params) {
  const { eventType } = await params;
  const body = (await request.json()) as Partial<{ enabled: boolean }>;

  const existing = getSequence(eventType);
  if (!existing) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  let updated = existing;
  saveConfig((config) => ({
    ...config,
    sequences: config.sequences.map((sequence) => {
      if (sequence.eventType !== eventType) return sequence;
      updated = eventSequenceSchema.parse({
        ...sequence,
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      });
      return updated;
    }),
  }));

  logger.info("routines", `${eventType} enabled=${updated.enabled}`);
  broadcaster.emitConfigUpdated();
  return NextResponse.json(updated);
}
