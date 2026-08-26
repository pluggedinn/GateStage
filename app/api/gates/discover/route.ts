import { NextResponse } from "next/server";
import { syncGatesFromNetwork } from "@/lib/gate-discovery";
import { logger } from "@/lib/logger";

/** Ask gates to announce (UDP WHO) and ping last-known hosts. */
export async function POST() {
  logger.info("gates", "manual network scan requested");
  const result = await syncGatesFromNetwork();
  return NextResponse.json(result);
}
