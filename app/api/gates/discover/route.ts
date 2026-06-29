import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { syncGatesFromNetwork } from "@/lib/gate-discovery";

export async function POST() {
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
