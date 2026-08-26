import { NextResponse } from "next/server";
import { getGate, getGates } from "@/lib/config/store";
import type { EsphomeCommand } from "@/lib/esphome";
import { sendEsphomeCommand } from "@/lib/esphome";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ gateId: string }> };

/** Send an ESPHome command to one gate, or to every enabled gate when `gateId` is `all`. */
export async function POST(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as EsphomeCommand;

  if (gateId === "all") {
    const gates = getGates().filter((g) => g.enabled);
    if (gates.length === 0) {
      return NextResponse.json({ error: "No enabled gates" }, { status: 404 });
    }

    const results = await Promise.all(
      gates.map((gate) => sendEsphomeCommand(gate.host, body)),
    );
    const failed = results.filter((r) => !r.ok);

    logger.info(
      "manual",
      `all gates command failed=${failed.length}/${results.length}`,
      body,
    );

    return NextResponse.json({
      ok: failed.length === 0,
      status: failed[0]?.status,
      sent: results.length,
      failed: failed.length,
    });
  }

  const gate = getGate(gateId);
  if (!gate) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  const res = await sendEsphomeCommand(gate.host, body);
  logger.info(
    "manual",
    `${gateId} ${res.ok ? "ok" : `HTTP ${res.status}`} host=${gate.host}`,
    body,
  );
  return NextResponse.json({ ok: res.ok, status: res.status });
}
