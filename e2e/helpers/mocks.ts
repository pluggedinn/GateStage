const NEXT_MOCK_HTTP = "http://127.0.0.1:9401";
const ESPHOME_MOCK = "http://127.0.0.1:9080";

export async function resetEsphome() {
  await fetch(`${ESPHOME_MOCK}/reset`, { method: "POST" });
}

export async function getEsphomeState() {
  const res = await fetch(`${ESPHOME_MOCK}/state`);
  return res.json() as Promise<{
    commands: Array<{
      entity: string;
      action: string;
      params: Record<string, string>;
    }>;
  }>;
}

export async function emitNextEvent(type: string) {
  const res = await fetch(`${NEXT_MOCK_HTTP}/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error(`emit failed: ${res.status}`);
}

export async function waitForEsphomeCommands(
  minCount: number,
  timeoutMs = 5000,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await getEsphomeState();
    if (state.commands.length >= minCount) return state;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Expected >= ${minCount} ESPHome commands`);
}
