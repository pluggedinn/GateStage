import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { settingsPatchSchema } from "@/lib/config/schema";
import { getConfig, setSetting } from "@/lib/config/store";
import { reloadRaceManagerListener } from "@/lib/race-brain";

const CONNECTION_SETTING_KEYS = [
  "raceManagerProvider",
  "nextWsUrl",
  "rotorHazardUrl",
] as const;

export async function GET() {
  return NextResponse.json(getConfig().settings);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.raceManagerProvider !== undefined) {
    setSetting("raceManagerProvider", parsed.data.raceManagerProvider);
  }
  if (parsed.data.nextWsUrl !== undefined) {
    setSetting("nextWsUrl", parsed.data.nextWsUrl);
  }
  if (parsed.data.rotorHazardUrl !== undefined) {
    setSetting("rotorHazardUrl", parsed.data.rotorHazardUrl);
  }
  if (parsed.data.defaultBrightnessPercent !== undefined) {
    setSetting(
      "defaultBrightnessPercent",
      parsed.data.defaultBrightnessPercent,
    );
  }

  const connectionChanged = CONNECTION_SETTING_KEYS.some(
    (key) => key in body,
  );
  if (connectionChanged) {
    reloadRaceManagerListener();
  }

  broadcaster.emitConfigUpdated();
  return NextResponse.json(getConfig().settings);
}
