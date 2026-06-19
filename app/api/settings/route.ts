import { NextResponse } from "next/server";
import { getConfig, setSetting } from "@/lib/config/store";
import { settingsSchema } from "@/lib/config/schema";
import { broadcaster } from "@/lib/broadcaster";

export async function GET() {
  return NextResponse.json(getConfig().settings);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = settingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.nextWsUrl !== undefined) {
    setSetting("nextWsUrl", parsed.data.nextWsUrl);
  }
  if (parsed.data.defaultBrightnessPercent !== undefined) {
    setSetting(
      "defaultBrightnessPercent",
      parsed.data.defaultBrightnessPercent,
    );
  }

  broadcaster.emitConfigUpdated();
  return NextResponse.json(getConfig().settings);
}
