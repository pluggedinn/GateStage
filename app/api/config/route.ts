import { NextResponse } from "next/server";
import { configSchema } from "@/lib/config/schema";
import { getConfig, saveConfig } from "@/lib/config/store";
import { logger } from "@/lib/logger";
import { getRaceBrain } from "@/lib/race-brain";

/** Export the full config (settings, gates, routines). */
export async function GET() {
  getRaceBrain();
  return NextResponse.json(getConfig());
}

/** Import a full config payload, replacing what is on disk. */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  saveConfig(() => parsed.data);
  logger.info("config", "imported", {
    gates: parsed.data.gates.length,
    sequences: parsed.data.sequences.length,
    settings: parsed.data.settings,
  });
  return NextResponse.json({ ok: true });
}
