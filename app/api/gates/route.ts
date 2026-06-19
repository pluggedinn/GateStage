import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { getGates, saveConfig } from "@/lib/config/store";

export async function GET() {
  return NextResponse.json(getGates());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id: string;
    host: string;
    isStartGate?: boolean;
    enabled?: boolean;
    sortOrder?: number;
  };

  if (!body.id?.trim() || !body.host?.trim()) {
    return NextResponse.json(
      { error: "id and host are required" },
      { status: 400 },
    );
  }

  const gate = {
    id: body.id.trim(),
    host: body.host.trim(),
    isStartGate: body.isStartGate ?? false,
    enabled: body.enabled ?? true,
    sortOrder: body.sortOrder ?? 0,
  };

  const existing = getGates().find((g) => g.id === gate.id);
  if (existing) {
    return NextResponse.json({ error: "Gate id already exists" }, { status: 409 });
  }

  saveConfig((config) => {
    const gates = config.gates.map((g) =>
      gate.isStartGate ? { ...g, isStartGate: false } : g,
    );
    return { ...config, gates: [...gates, gate] };
  });

  broadcaster.emitConfigUpdated();
  return NextResponse.json(gate, { status: 201 });
}
