export type MockFleetGate = {
  id: string;
  port: number;
};

/** Six dev gates — one mock HTTP server each (ports 9080–9085). */
export const ESPHOME_MOCK_FLEET: readonly MockFleetGate[] = [
  { id: "gate-start", port: 9080 },
  { id: "gate-2", port: 9081 },
  { id: "gate-3", port: 9082 },
  { id: "gate-4", port: 9083 },
  { id: "gate-5", port: 9084 },
  { id: "gate-finish", port: 9085 },
] as const;

export function esphomeMockFleetHosts(): { id: string; host: string }[] {
  return ESPHOME_MOCK_FLEET.map((gate) => ({
    id: gate.id,
    host: `127.0.0.1:${gate.port}`,
  }));
}
