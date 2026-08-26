import { NextResponse } from "next/server";
import { getGates } from "@/lib/config/store";
import { getHealth } from "@/lib/gate-presence";

/** List known gates in track order, with live health. */
export async function GET() {
  const gates = getGates().map((gate) => ({
    ...gate,
    ...getHealth(gate.id),
  }));
  return NextResponse.json(gates);
}
