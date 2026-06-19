import { NextResponse } from "next/server";
import { broadcaster } from "@/lib/broadcaster";
import { eventMappingSchema } from "@/lib/config/schema";
import { saveConfig } from "@/lib/config/store";

type Params = { params: Promise<{ mappingId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { mappingId } = await params;
  const body = await request.json();

  let updated: (typeof body & { id: string }) | null = null;
  let notFound = true;

  saveConfig((config) => {
    const mappings = config.mappings.map((m) => {
      if (m.id !== mappingId) return m;
      notFound = false;
      const merged = { ...m, ...body, id: mappingId };
      updated = eventMappingSchema.parse(merged);
      return updated;
    });
    return { ...config, mappings };
  });

  if (notFound) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  broadcaster.emitConfigUpdated();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { mappingId } = await params;
  let notFound = true;

  saveConfig((config) => {
    const before = config.mappings.length;
    const mappings = config.mappings.filter((m) => m.id !== mappingId);
    notFound = mappings.length === before;
    return { ...config, mappings };
  });

  if (notFound) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }

  broadcaster.emitConfigUpdated();
  return NextResponse.json({ ok: true });
}
