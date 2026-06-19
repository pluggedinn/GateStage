import { NextResponse } from "next/server";
import { getGate } from "@/lib/config/store";
import type { EsphomeCommand } from "@/lib/esphome";
import { sendEsphomeCommand } from "@/lib/esphome";

type Params = { params: Promise<{ gateId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { gateId } = await params;
  const body = (await request.json()) as EsphomeCommand;

  const gate = getGate(gateId);
  if (!gate) {
    return NextResponse.json({ error: "Gate not found" }, { status: 404 });
  }

  const res = await sendEsphomeCommand(gate.host, body);
  return NextResponse.json({ ok: res.ok, status: res.status });
}
