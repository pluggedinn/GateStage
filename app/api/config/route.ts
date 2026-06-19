import { NextResponse } from "next/server";
import { getConfig, saveConfig } from "@/lib/config/store";
import { configSchema } from "@/lib/config/schema";
import { getRaceBrain } from "@/lib/race-brain";

export async function GET() {
  getRaceBrain();
  return NextResponse.json(getConfig());
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  saveConfig(() => parsed.data);
  return NextResponse.json({ ok: true });
}
