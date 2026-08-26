import type { Gate } from "@/lib/config/schema";

export const GATESTAGE_BEACON_PORT = Number(
  process.env.GATESTAGE_BEACON_PORT ?? 9420,
);

export const DEFAULT_GATE_HTTP_PORT = Number(
  process.env.GATESTAGE_ESPHOME_HTTP_PORT ?? 80,
);

export const GATE_OFFLINE_AFTER_MS = Number(
  process.env.GATESTAGE_GATE_OFFLINE_AFTER_MS ?? 15_000,
);

export type GateHealth = {
  online: boolean;
  lastSeenAt: string | null;
  rssi: number | null;
  tempC: number | null;
};

export type GateHealthEvent = {
  gateId: string;
} & GateHealth;

export type GateView = Gate & GateHealth;

export type GateHealthSnapshot = Record<string, GateHealth>;

export type WhoPacket = { kind: "who" };

export type BeaconPacket = {
  kind: "beacon";
  id: string;
  rssi: number | null;
  tempC: number | null;
  port: number;
};

export type ParsedUdpPacket = WhoPacket | BeaconPacket;

const emptyHealth = (): GateHealth => ({
  online: false,
  lastSeenAt: null,
  rssi: null,
  tempC: null,
});

export function emptyGateHealth(): GateHealth {
  return emptyHealth();
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseUdpPacket(raw: string): ParsedUdpPacket | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;

    if (obj.q === "who") {
      return { kind: "who" };
    }

    if (typeof obj.id !== "string" || obj.id.trim() === "") return null;

    const port = asFiniteNumber(obj.port);
    return {
      kind: "beacon",
      id: obj.id.trim(),
      rssi: asFiniteNumber(obj.rssi),
      tempC: asFiniteNumber(obj.tC),
      port:
        port !== null && port > 0 && port < 65536
          ? Math.floor(port)
          : DEFAULT_GATE_HTTP_PORT,
    };
  } catch {
    return null;
  }
}

export function whoPacketJson(): string {
  return JSON.stringify({ v: 1, q: "who" });
}

export function hostFromSighting(address: string, port: number): string {
  const ipv4 = address.startsWith("::ffff:") ? address.slice(7) : address;
  return `${ipv4}:${port}`;
}

export function formatLastSeen(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "never";
  if (ms < 1000) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}
