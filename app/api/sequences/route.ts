import { NextResponse } from "next/server";
import { getSequences } from "@/lib/config/store";

/** List all race-event routines (sequences) and their steps. */
export async function GET() {
  return NextResponse.json(getSequences());
}
