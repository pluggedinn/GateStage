import { NextResponse } from "next/server";
import { getSequences } from "@/lib/config/store";

export async function GET() {
  return NextResponse.json(getSequences());
}
