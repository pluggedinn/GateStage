import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import {
  forgetGate,
  getGate,
  rememberStartGateId,
  saveConfig,
} from "@/lib/config/store";
import { pingGate, sendEsphomeCommand } from "@/lib/esphome";
import { clearHealth, getHealth, recordPingResult } from "@/lib/gate-presence";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ gateId: string }> };

/** Update a gate's start-gate flag, enabled state, or sort order. */
export async function PATCH(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as Partial<{
    isStartGate: boolean;
    enabled: boolean;
    sortOrder: number;
  }>;

  const existing = getGate(gateId);
  if (!existing) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  let updated = existing;
  saveConfig((config) => ({
    ...config,
    gates: config.gates.map((g) => {
      if (body.isStartGate && g.id !== gateId) {
        return { ...g, isStartGate: false };
      }
      if (g.id !== gateId) return g;
      updated = {
        ...g,
        ...(body.isStartGate !== undefined && {
          isStartGate: body.isStartGate,
        }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      };
      return updated;
    }),
  }));

  if (body.isStartGate === true) {
    rememberStartGateId(gateId);
  } else if (body.isStartGate === false) {
    rememberStartGateId(null);
  }

  logger.info("gates", `updated ${gateId}`, {
    isStartGate: updated.isStartGate,
    enabled: updated.enabled,
    sortOrder: updated.sortOrder,
    patch: body,
  });

  broadcaster.emitConfigUpdated();
  return NextResponse.json({ ...updated, ...getHealth(gateId) });
}

/** Forget a gate. If it is still on the LAN, the next beacon will add it back. */
export async function DELETE(_request: Request, { params }: Params) {
  const { gateId } = await params;
  if (!getGate(gateId)) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  const gates = forgetGate(gateId);
  clearHealth(gateId);
  logger.info("gates", `forgot ${gateId}`);
  broadcaster.emitConfigUpdated();
  return NextResponse.json(gates);
}

/** Ping a gate for reachability, or run a rainbow test effect (`action: "ping" | "test"`). */
export async function POST(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as { action?: "ping" | "test" };

  const gate = getGate(gateId);
  if (!gate) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  if (body.action === "ping") {
    const online = await pingGate(gate.host);
    recordPingResult(gateId, online);
    logger.info(
      "gates",
      `ping ${gateId} ${online ? "online" : "offline"} host=${gate.host}`,
    );
    return NextResponse.json({ gateId, ...getHealth(gateId) });
  }

  const res = await sendEsphomeCommand(gate.host, {
    kind: "effect",
    effectId: "addressable_rainbow",
  });
  logger.info(
    "gates",
    `test ${gateId} rainbow ${res.ok ? "ok" : `HTTP ${res.status}`} host=${gate.host}`,
  );
  return NextResponse.json({ ok: res.ok, status: res.status });
}
