import { Bonjour, type Service } from "bonjour-service";
import {
  mergeDiscoveredGates,
  type MergeDiscoveryResult,
} from "@/lib/config/store";
import { esphomeMockFleetHosts } from "@/lib/dev/esphome-mock-fleet";
import { pingGate } from "@/lib/esphome";

export type DiscoveredGate = {
  id: string;
  host: string;
  source: "mdns" | "env";
};

const DEFAULT_SCAN_MS = Number(process.env.GATESTAGE_DISCOVERY_TIMEOUT_MS ?? 5000);
const WEB_SERVER_PORT = Number(process.env.GATESTAGE_ESPHOME_HTTP_PORT ?? 80);

function normalizeGateId(name: string): string {
  const base = name.split(".")[0] ?? name;
  return base.trim().replace(/\s+/g, "-").toLowerCase();
}

function serviceToGate(service: Service): DiscoveredGate | null {
  const id = normalizeGateId(service.name);
  const ipv4 =
    service.addresses?.find((addr) => addr.includes(".")) ??
    (service.referer?.family === "IPv4" ? service.referer.address : undefined);

  if (!id || !ipv4) return null;

  return {
    id,
    host: `${ipv4}:${WEB_SERVER_PORT}`,
    source: "mdns",
  };
}

function gatesFromEnv(): DiscoveredGate[] {
  const gates: DiscoveredGate[] = [];

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

async function verifyDiscovered(
  candidates: Map<string, DiscoveredGate>,
): Promise<DiscoveredGate[]> {
  const verified: DiscoveredGate[] = [];

  for (const gate of candidates.values()) {
    if (await pingGate(gate.host)) {
      verified.push(gate);
    } else {
      console.warn(`[discovery] unreachable: ${gate.id} @ ${gate.host}`);
    }
  }

  return verified.sort((a, b) => a.id.localeCompare(b.id));
}

async function discoverGates(timeoutMs = DEFAULT_SCAN_MS): Promise<DiscoveredGate[]> {
  const candidates = new Map<string, DiscoveredGate>();

  for (const gate of gatesFromEnv()) {
    candidates.set(gate.id, gate);
  }

  await new Promise<void>((resolve) => {
    const bonjour = new Bonjour();
    const browser = bonjour.find({ type: "esphomelib", protocol: "tcp" });

    const finish = () => {
      browser.stop();
      bonjour.destroy();
      resolve();
    };

    browser.on("up", (service) => {
      const gate = serviceToGate(service);
      if (gate) candidates.set(gate.id, gate);
    });

    setTimeout(finish, timeoutMs);
  });

  return verifyDiscovered(candidates);
}

export async function syncGatesFromNetwork(
  timeoutMs?: number,
): Promise<MergeDiscoveryResult> {
  const discovered = await discoverGates(timeoutMs);
  return mergeDiscoveredGates(discovered);
}
