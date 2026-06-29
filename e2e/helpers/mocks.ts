import { ESPHOME_MOCK_FLEET } from "../../lib/dev/esphome-mock-fleet";

const NEXT_MOCK_HTTP = "http://127.0.0.1:9401";

function esphomeMockUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}

export async function resetEsphome() {
  await Promise.all(
    ESPHOME_MOCK_FLEET.map((gate) =>
      fetch(`${esphomeMockUrl(gate.port)}/reset`, { method: "POST" }),
    ),
  );
}

export async function getEsphomeState(port = ESPHOME_MOCK_FLEET[0].port) {
  const res = await fetch(`${esphomeMockUrl(port)}/state`);
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
  port = ESPHOME_MOCK_FLEET[0].port,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await getEsphomeState(port);
    if (state.commands.length >= minCount) return state;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Expected >= ${minCount} ESPHome commands`);
}
