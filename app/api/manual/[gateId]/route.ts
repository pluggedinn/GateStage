import { NextResponse } from "next/server";
import type { ChoreographyAction } from "@/lib/choreography/types";
import { getGate, getGates } from "@/lib/config/store";
import type { EsphomeCommand } from "@/lib/esphome";
import { ALL_EXCEPT_START_TARGET, gatesExceptStart } from "@/lib/gate-targets";
import { logger } from "@/lib/logger";
import { getRaceBrain } from "@/lib/race-brain";

type Params = { params: Promise<{ gateId: string }> };

/** Send an ESPHome command to one gate, a gate group, or a track choreography when `gateId` is `all`. */
export async function POST(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as EsphomeCommand | ChoreographyAction;

  if (body.kind === "choreography") {
    if (gateId !== "all") {
      return NextResponse.json(
        {
          ok: false,
          error: "Choreography requires all gates",
          status: 400,
        },
        { status: 400 },
      );
    }

    const { gateEngine } = getRaceBrain();
    const result = await gateEngine.runManualChoreography(body);
    if ("error" in result) {
      return NextResponse.json(
        { ok: false, error: result.error, status: result.status },
        { status: result.status },
      );
    }

    logger.info(
      "manual",
      `all gates choreography ${body.choreographyId} failed=${result.failed}/${result.sent}`,
    );

    return NextResponse.json({
      ok: result.ok,
      sent: result.sent,
      failed: result.failed,
    });
  }

  if (gateId === "all" || gateId === ALL_EXCEPT_START_TARGET) {
    const gates =
      gateId === ALL_EXCEPT_START_TARGET
        ? gatesExceptStart(getGates())
        : getGates().filter((g) => g.enabled);
    if (gates.length === 0) {
      return NextResponse.json(
        {
          error:
            gateId === ALL_EXCEPT_START_TARGET
              ? "No enabled gates besides the start gate"
              : "No enabled gates",
        },
        { status: 404 },
      );
    }

    const { gateEngine } = getRaceBrain();
    const results = await Promise.all(
      gates.map((gate) => gateEngine.sendManualCommand(gate, body)),
    );
    const failed = results.filter((r) => !r.ok);

    const group =
      gateId === ALL_EXCEPT_START_TARGET ? "all except start" : "all gates";
    logger.info(
      "manual",
      `${group} command failed=${failed.length}/${results.length}`,
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

  const { gateEngine } = getRaceBrain();
  const result = await gateEngine.sendManualCommand(gate, body);
  logger.info(
    "manual",
    `${gateId} ${result.ok ? "ok" : `failed`} host=${gate.host}`,
    body,
  );
  return NextResponse.json({
    ok: result.ok,
    status: "status" in result ? result.status : undefined,
  });
}
