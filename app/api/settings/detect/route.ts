import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { detectRaceManager } from "@/lib/race-manager-detect";

const bodySchema = z.object({
  provider: z.enum(["next", "rotorhazard"]),
});

/** Probe the race LAN for the selected race manager; does not save settings. */
export async function POST(request: Request) {
  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "provider must be next or rotorhazard" },
      { status: 400 },
    );
  }

  const { provider } = parsed.data;
  logger.info("settings", `detect requested for ${provider}`);
  const result = await detectRaceManager(provider);
  return NextResponse.json(result);
}
