import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { eventMappingSchema } from "@/lib/config/schema";
import { getMappings, saveConfig } from "@/lib/config/store";

export async function GET() {
  return NextResponse.json(getMappings());
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = eventMappingSchema
    .omit({ id: true })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const mapping = { id: randomUUID(), ...parsed.data };
  saveConfig((config) => ({
    ...config,
    mappings: [...config.mappings, mapping],
  }));
  broadcaster.emitConfigUpdated();
  return NextResponse.json(mapping, { status: 201 });
}
