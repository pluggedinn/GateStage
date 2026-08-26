import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcaster } from "@/lib/broadcaster";
import { reorderSequenceSteps } from "@/lib/config/store";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ eventType: string }> };

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

/** Reorder steps in a routine (`orderedIds` must list every step once). */
export async function POST(request: Request, { params }: Params) {
  const { eventType } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "orderedIds must be an array of step ids" },
      { status: 400 },
    );
  }

  try {
    const sequence = reorderSequenceSteps(eventType, parsed.data.orderedIds);
    logger.info(
      "routines",
      `reordered steps for ${eventType}`,
      parsed.data.orderedIds,
    );
    broadcaster.emitConfigUpdated();
    return NextResponse.json(sequence);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reorder failed";
    const status = message === "Routine not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
