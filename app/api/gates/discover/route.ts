import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { syncGatesFromNetwork } from "@/lib/gate-discovery";
import { logger } from "@/lib/logger";

/** Run an on-demand mDNS/ESPHome scan and merge results into the gate list. */
export async function POST() {
  logger.info("gates", "manual network scan requested");
  const result = await syncGatesFromNetwork();

  if (
    result.added.length > 0 ||
    result.updated.length > 0 ||
    result.removed.length > 0
  ) {
    broadcaster.emitConfigUpdated();
  }

  return NextResponse.json(result);
}
