import { NextResponse } from "next/server";
import { getGates } from "@/lib/config/store";

export async function GET() {
  return NextResponse.json(getGates());
}
