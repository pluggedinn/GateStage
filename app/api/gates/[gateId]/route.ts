import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { getGate, saveConfig } from "@/lib/config/store";
import { pingGate, sendEsphomeCommand } from "@/lib/esphome";

type Params = { params: Promise<{ gateId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as Partial<{
    host: string;
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
        ...(body.host !== undefined && { host: body.host }),
        ...(body.isStartGate !== undefined && {
          isStartGate: body.isStartGate,
        }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      };
      return updated;
    }),
  }));

  broadcaster.emitConfigUpdated();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { gateId } = await params;
  const existing = getGate(gateId);
  if (!existing) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  saveConfig((config) => ({
    ...config,
    gates: config.gates.filter((g) => g.id !== gateId),
  }));
  broadcaster.emitConfigUpdated();
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as { action?: "ping" | "test" };

  const gate = getGate(gateId);
  if (!gate) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  if (body.action === "ping") {
    const online = await pingGate(gate.host);
    broadcaster.emitGateHealth(gateId, online);
    return NextResponse.json({ online });
  }

  const res = await sendEsphomeCommand(gate.host, {
    kind: "effect",
    effectId: "addressable_rainbow",
  });
  return NextResponse.json({ ok: res.ok, status: res.status });
}
