import dgram from "node:dgram";
import { broadcaster } from "@/lib/broadcaster";
import {
  type DiscoveredGateSummary,
  getGates,
  type MergeDiscoveryResult,
  mergeDiscoveredGates,
} from "@/lib/config/store";
import { pingGate } from "@/lib/esphome";
import {
  emptyGateHealth,
  GATE_OFFLINE_AFTER_MS,
  GATESTAGE_BEACON_PORT,
  type GateHealth,
  type GateHealthEvent,
  type GateHealthSnapshot,
  hostFromSighting,
  parseUdpPacket,
  whoPacketJson,
} from "@/lib/gate-health";
import { logger } from "@/lib/logger";

const GLOBAL_PRESENCE_KEY = "__gatestage_gate_presence__";

type PresenceState = {
  healthById: Map<string, GateHealth>;
  socket: dgram.Socket | null;
  pingTimer: NodeJS.Timeout | null;
  sweepTimer: NodeJS.Timeout | null;
  lock: Promise<void>;
};

function presenceState(): PresenceState {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_PRESENCE_KEY]?: PresenceState;
  };
  if (!globalStore[GLOBAL_PRESENCE_KEY]) {
    globalStore[GLOBAL_PRESENCE_KEY] = {
      healthById: new Map(),
      socket: null,
      pingTimer: null,
      sweepTimer: null,
      lock: Promise.resolve(),
    };
  }
  return globalStore[GLOBAL_PRESENCE_KEY];
}

const PING_INTERVAL_MS = Number(
  process.env.GATESTAGE_DISCOVERY_INTERVAL_MS ?? 8_000,
);
const WHO_WAIT_MS = Number(process.env.GATESTAGE_WHO_WAIT_MS ?? 750);

function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const state = presenceState();
  const run = state.lock.then(fn, fn);
  state.lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emitHealth(gateId: string) {
  const health = getHealth(gateId);
  const event: GateHealthEvent = { gateId, ...health };
  broadcaster.emitGateHealth(event);
}

export function getHealth(gateId: string): GateHealth {
  return presenceState().healthById.get(gateId) ?? emptyGateHealth();
}

export function getHealthSnapshot(): GateHealthSnapshot {
  const snapshot: GateHealthSnapshot = {};
  for (const gate of getGates()) {
    snapshot[gate.id] = getHealth(gate.id);
  }
  for (const [id, health] of presenceState().healthById) {
    if (!(id in snapshot)) snapshot[id] = health;
  }
  return snapshot;
}

export function clearHealth(gateId: string) {
  presenceState().healthById.delete(gateId);
}

function markSeen(
  gateId: string,
  telemetry: { rssi?: number | null; tempC?: number | null } = {},
) {
  const previous = getHealth(gateId);
  const rssi =
    telemetry.rssi === undefined || telemetry.rssi === null
      ? previous.rssi
      : telemetry.rssi;
  const tempC =
    telemetry.tempC === undefined || telemetry.tempC === null
      ? previous.tempC
      : telemetry.tempC;
  presenceState().healthById.set(gateId, {
    online: true,
    lastSeenAt: new Date().toISOString(),
    rssi,
    tempC,
  });
  emitHealth(gateId);
}

export function recordPingResult(gateId: string, online: boolean) {
  if (online) {
    markSeen(gateId);
    return;
  }
  const previous = getHealth(gateId);
  if (!previous.lastSeenAt) {
    presenceState().healthById.set(gateId, { ...previous, online: false });
    emitHealth(gateId);
  }
}

function sweepOffline() {
  const cutoff = Date.now() - GATE_OFFLINE_AFTER_MS;
  const state = presenceState();
  const ids = new Set([
    ...getGates().map((g) => g.id),
    ...state.healthById.keys(),
  ]);
  for (const id of ids) {
    const health = getHealth(id);
    if (!health.online) continue;
    if (!health.lastSeenAt) {
      state.healthById.set(id, { ...health, online: false });
      emitHealth(id);
      continue;
    }
    if (Date.parse(health.lastSeenAt) < cutoff) {
      state.healthById.set(id, { ...health, online: false });
      emitHealth(id);
    }
  }
}

async function applySighting(item: DiscoveredGateSummary): Promise<boolean> {
  return withLock(async () => {
    const result = mergeDiscoveredGates([item]);
    const changed = result.added.length > 0 || result.updated.length > 0;
    if (changed) {
      broadcaster.emitConfigUpdated();
    }
    return changed;
  });
}

async function handleBeacon(
  id: string,
  address: string,
  port: number,
  rssi: number | null,
  tempC: number | null,
) {
  const host = hostFromSighting(address, port);
  await applySighting({ id, host, source: "udp" });
  markSeen(id, { rssi, tempC });
}

function bindUdp() {
  const state = presenceState();
  if (state.socket) return;

  const next = dgram.createSocket({ type: "udp4", reuseAddr: true });
  state.socket = next;

  next.on("error", (err) => {
    logger.error("presence", `udp ${GATESTAGE_BEACON_PORT} error`, err);
  });

  next.on("message", (msg, rinfo) => {
    const parsed = parseUdpPacket(msg.toString("utf8"));
    if (!parsed || parsed.kind === "who") return;
    void handleBeacon(
      parsed.id,
      rinfo.address,
      parsed.port,
      parsed.rssi,
      parsed.tempC,
    );
  });

  next.bind(GATESTAGE_BEACON_PORT, "0.0.0.0", () => {
    try {
      next.setBroadcast(true);
    } catch (err) {
      logger.warn("presence", "udp setBroadcast failed", err);
    }
    logger.info("presence", `listening udp 0.0.0.0:${GATESTAGE_BEACON_PORT}`);
  });
}

export function broadcastWho() {
  const socket = presenceState().socket;
  if (!socket) return;
  const payload = Buffer.from(whoPacketJson());
  socket.send(
    payload,
    0,
    payload.length,
    GATESTAGE_BEACON_PORT,
    "255.255.255.255",
    (err) => {
      if (err) logger.warn("presence", "who broadcast failed", err);
    },
  );
}

async function pingKnownHosts() {
  const gates = getGates();
  await Promise.all(
    gates.map(async (gate) => {
      const online = await pingGate(gate.host);
      recordPingResult(gate.id, online);
      if (!online) {
        logger.debug("presence", `ping miss ${gate.id} host=${gate.host}`);
      }
    }),
  );
  sweepOffline();
}

export async function pingKnownGates(): Promise<void> {
  await pingKnownHosts();
}

export async function mergeEnvCandidates(
  candidates: DiscoveredGateSummary[],
): Promise<MergeDiscoveryResult> {
  return withLock(() => mergeDiscoveredGates(candidates));
}

export async function runPresenceScan(
  envCandidates: DiscoveredGateSummary[] = [],
): Promise<MergeDiscoveryResult> {
  broadcastWho();
  await new Promise((resolve) => setTimeout(resolve, WHO_WAIT_MS));

  const result = await mergeEnvCandidates(envCandidates);
  await pingKnownHosts();

  if (result.added.length > 0 || result.updated.length > 0) {
    logger.info(
      "discovery",
      `scan result added=${result.added.join(",") || "none"} updated=${result.updated.join(",") || "none"}`,
    );
    broadcaster.emitConfigUpdated();
  }

  return result;
}

export function startPresence() {
  const state = presenceState();
  bindUdp();
  if (!state.pingTimer) {
    void pingKnownHosts();
    state.pingTimer = setInterval(() => {
      void pingKnownHosts();
    }, PING_INTERVAL_MS);
  }
  if (!state.sweepTimer) {
    state.sweepTimer = setInterval(sweepOffline, 2_000);
  }
}

export function stopPresence() {
  const state = presenceState();
  if (state.pingTimer) clearInterval(state.pingTimer);
  state.pingTimer = null;
  if (state.sweepTimer) clearInterval(state.sweepTimer);
  state.sweepTimer = null;
  if (state.socket) {
    try {
      state.socket.close();
    } catch {
      // already closed
    }
    state.socket = null;
  }
}

/** Test helper. */
export function resetPresenceMemory() {
  presenceState().healthById.clear();
}
