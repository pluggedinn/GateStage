import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { mergeDiscoveredGates } from "@/lib/config/store";
import { discoverGates } from "@/lib/gate-discovery";

export async function POST() {
  const discovered = await discoverGates();
  const result = mergeDiscoveredGates(discovered);

  if (result.added.length > 0 || result.updated.length > 0) {
    broadcaster.emitConfigUpdated();
  }

  return NextResponse.json(result);
}
