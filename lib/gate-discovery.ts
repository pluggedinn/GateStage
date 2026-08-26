import type {
  DiscoveredGateSummary,
  MergeDiscoveryResult,
} from "@/lib/config/store";
import { esphomeMockFleetHosts } from "@/lib/dev/esphome-mock-fleet";
import { runPresenceScan } from "@/lib/gate-presence";

export type DiscoveredGate = DiscoveredGateSummary;

export function gatesFromEnv(): DiscoveredGateSummary[] {
  const gates: DiscoveredGateSummary[] = [];

  if (process.env.ESPHOME_MOCK_FLEET === "1") {
    for (const gate of esphomeMockFleetHosts()) {
      gates.push({ ...gate, source: "env" });
    }
    return gates;
  }

  const mockHost = process.env.ESPHOME_MOCK_HOST;
  if (mockHost) {
    gates.push({
      id: process.env.GATESTAGE_MOCK_GATE_ID ?? "gate-mock",
      host: mockHost,
      source: "env",
    });
  }

  const extra = process.env.GATESTAGE_DISCOVERY_EXTRA;
  if (extra) {
    for (const part of extra.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const at = trimmed.indexOf("@");
      if (at === -1) continue;
      const id = trimmed.slice(0, at).trim();
      const host = trimmed.slice(at + 1).trim();
      if (id && host) gates.push({ id, host, source: "env" });
    }
  }

  return gates;
}

export async function syncGatesFromNetwork(): Promise<MergeDiscoveryResult> {
  return runPresenceScan(gatesFromEnv());
}
