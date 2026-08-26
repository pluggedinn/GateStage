import { NextResponse } from "next/server";
import { getGates } from "@/lib/config/store";

/** List discovered gates in track order. */
export async function GET() {
  return NextResponse.json(getGates());
}
