import { NextResponse } from "next/server";
import { readLogTail } from "@/lib/logger";

/** Return the log file path and the last ~256 KB of `gatestage.log`. */
export async function GET() {
  return NextResponse.json(readLogTail());
}
