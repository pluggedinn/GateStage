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
  uptimeSec: number | null;
  disconnects: number | null;
  rssiMin: number | null;
  lastOfflineAt: string | null;
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
  uptimeSec: number | null;
  disconnects: number | null;
  rssiMin: number | null;
};

export type ParsedUdpPacket = WhoPacket | BeaconPacket;

const emptyHealth = (): GateHealth => ({
  online: false,
  lastSeenAt: null,
  rssi: null,
  tempC: null,
  uptimeSec: null,
  disconnects: null,
  rssiMin: null,
  lastOfflineAt: null,
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

export const RSSI_HISTORY_MAX = 20;

/** RSSI is negative; 0 or positive in a beacon means "no sample". */
function asRssi(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null || n >= 0) return null;
  return n;
}

export function appendRssiHistory(
  history: number[],
  rssi: number,
  max = RSSI_HISTORY_MAX,
): number[] {
  const next = history.length >= max ? history.slice(1) : history.slice();
  next.push(rssi);
  return next;
}

export function minRssi(
  values: Array<number | null | undefined>,
): number | null {
  let min: number | null = null;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (min === null || value < min) min = value;
  }
  return min;
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
      rssi: asRssi(obj.rssi),
      tempC: asFiniteNumber(obj.tC),
      port:
        port !== null && port > 0 && port < 65536
          ? Math.floor(port)
          : DEFAULT_GATE_HTTP_PORT,
      uptimeSec: asFiniteNumber(obj.up),
      disconnects: asFiniteNumber(obj.dc),
      rssiMin: asRssi(obj.rssiMin),
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
