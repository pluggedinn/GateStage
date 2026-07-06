import { NextResponse } from "next/server";
import { z } from "zod";
import { broadcaster } from "@/lib/broadcaster";
import { reorderGates } from "@/lib/config/store";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "orderedIds must be an array of gate ids" },
      { status: 400 },
    );
  }

  try {
    const gates = reorderGates(parsed.data.orderedIds);
    broadcaster.emitConfigUpdated();
    return NextResponse.json(gates);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reorder failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
