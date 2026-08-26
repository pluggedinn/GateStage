import { NextResponse } from "next/server";
import { getRaceBrain } from "@/lib/race-brain";

/** Liveness check used by Electron and local health probes. */
export async function GET() {
  getRaceBrain();
  return NextResponse.json({
    ok: true,
    service: "gatestage",
    timestamp: new Date().toISOString(),
  });
}
