import { io, type Socket } from "socket.io-client";
import type { Pilot, RaceEvent } from "@/lib/types";
import type { AdapterCallbacks, RaceManagerAdapter } from "./types";

/**
 * RotorHazard adapter.
 *
 * Translates RotorHazard Socket.io events into the shared {@link RaceEvent} model.
 *
 * **Sources (official repo):**
 * - Race status enum: `RHRace.RaceStatus` in RHRace.py (READY=0, RACING=1, DONE=2, STAGING=3)
 * - Client UI switch: run.html `switch (msg.race_status)` — case 1=racing, 2=stopped, 3=staging
 * - Socket emits: RHUI.py (`emit_race_status`, `emit_current_heat`, `emit_current_laps`, `emit_race_stage`)
 * - API docs: doc/RHAPI.md (`race.status`, socket broadcasts)
 * - Internal plugin events (OBS Websocks, etc.): eventmanager.py `Evt.RACE_STAGE` / `RACE_START` / `RACE_FINISH`
 *
 * @see https://github.com/RotorHazard/RotorHazard
 * @see https://github.com/RotorHazard/RotorHazard/blob/main/src/server/RHRace.py
 * @see https://github.com/RotorHazard/RotorHazard/blob/main/src/server/RHUI.py
 * @see https://github.com/RotorHazard/RotorHazard/blob/main/doc/RHAPI.md
 */

/** RotorHazard `RHRace.RaceStatus` — values are NOT sequential. */
const RaceStatus = {
  READY: 0,
  RACING: 1,
  DONE: 2,
  STAGING: 3,
} as const;

type RaceStatusPayload = { race_status?: number; race_heat_id?: number | null };
type RaceStagePayload = { race_node_colors?: number[] };

type HeatNodeSlot = {
  pilot_id?: number | null;
  callsign?: string | null;
  heatNodeColor?: number | string | null;
  pilotColor?: number | string | null;
  activeColor?: number | null;
};

type CurrentHeatPayload = {
  current_heat?: number | null;
  heatNodes?: Record<string, HeatNodeSlot>;
  next_round?: number | null;
};

type LapEntry = {
  lap_number?: number;
  lap_time_stamp?: number;
};

type LapNode = {
  laps?: LapEntry[];
  pilot?: { id?: number; callsign?: string; color?: number | string } | null;
};

type CurrentLapsPayload = {
  current?: { node_index?: LapNode[] };
};

/** Convert a RotorHazard 24-bit color int (0xRRGGBB) into an RGB triple. */
function intToRgb(value: number): { r: number; g: number; b: number } {
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function parseRhColor(value: number | string | null | undefined): {
  r: number;
  g: number;
  b: number;
} {
  if (typeof value === "number") return intToRgb(value);
  if (typeof value === "string") {
    const hex = value.startsWith("#") ? value.slice(1) : value;
    const parsed = Number.parseInt(hex, 16);
    if (!Number.isNaN(parsed)) return intToRgb(parsed);
  }
  return { r: 255, g: 255, b: 255 };
}

/**
 * Map a race_status transition to a GateStage event.
 * Only valid lifecycle edges emit — ignores reconnect noise and duplicate statuses.
 */
function eventForStatusTransition(
  from: number | null,
  to: number,
): "heat.arm_started" | "heat.go" | "heat.finished" | null {
  if (from === to) return null;

  switch (to) {
    case RaceStatus.STAGING:
      return from === RaceStatus.READY || from === null
        ? "heat.arm_started"
        : null;
    case RaceStatus.RACING:
      return from === RaceStatus.STAGING ? "heat.go" : null;
    case RaceStatus.DONE:
      return from === RaceStatus.RACING ? "heat.finished" : null;
    case RaceStatus.READY:
      return null;
    default:
      return null;
  }
}

/** RotorHazard Socket.io listens on the server origin (host:port), not page paths like /run. */
export function normalizeRotorHazardUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed;
  }
}

export class RotorHazardAdapter implements RaceManagerAdapter {
  readonly provider = "rotorhazard" as const;

  private socket: Socket | null = null;
  private connected = false;
  private lastRaceStatus: number | null = null;
  private currentHeatId: number | null = null;
  /** Per-node lap counts from the last `current_laps` payload (for crossing detection). */
  private lapCounts: number[] = [];
  /** Per-seat colors from `stage_ready` / `raceStage` payloads. */
  private nodeColors: number[] = [];
  /** Pilot info keyed by seat index, populated from `current_heat`. */
  private heatNodes: Map<number, HeatNodeSlot> = new Map();

  constructor(
    private url: string,
    private callbacks: AdapterCallbacks,
  ) {}

  isConnected() {
    return this.connected;
  }

  start() {
    const origin = normalizeRotorHazardUrl(this.url);
    this.socket = io(origin, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 3000,
    });

    this.socket.on("connect", () => {
      console.log("[rotorhazard-adapter] connected to", origin);
      this.setConnected(true);
      // Request current state (same pattern as RH web client on page load).
      this.socket?.emit("load_data", {
        load_types: ["current_heat", "race_status", "current_laps"],
      });
    });

    this.socket.on("disconnect", () => {
      console.log("[rotorhazard-adapter] disconnected");
      this.setConnected(false);
    });

    this.socket.on("connect_error", (err: Error) => {
      console.error("[rotorhazard-adapter] connect error:", err.message);
    });

    this.registerRaceEvents();
  }

  stop() {
    this.socket?.disconnect();
    this.socket = null;
    this.setConnected(false);
  }

  private setConnected(connected: boolean) {
    this.connected = connected;
    this.callbacks.onConnectionChange(connected);
  }

  private registerRaceEvents() {
    if (!this.socket) return;

    this.socket.on("race_status", (payload: RaceStatusPayload) => {
      this.handleRaceStatus(payload);
    });

    this.socket.on("current_heat", (payload: CurrentHeatPayload) => {
      this.handleCurrentHeat(payload);
    });

    this.socket.on("current_laps", (payload: CurrentLapsPayload) => {
      this.handleCurrentLaps(payload);
    });

    // `stage_ready` from RHUI.emit_race_stage() — carries seat LED colors at staging.
    this.socket.on("stage_ready", (payload: RaceStagePayload) => {
      if (Array.isArray(payload.race_node_colors)) {
        this.nodeColors = payload.race_node_colors;
      }
    });

    // Legacy/alternate event name seen on some RH versions.
    this.socket.on("raceStage", (payload: RaceStagePayload) => {
      if (Array.isArray(payload.race_node_colors)) {
        this.nodeColors = payload.race_node_colors;
      }
    });
  }

  private handleRaceStatus(payload: RaceStatusPayload) {
    const status = payload.race_status;
    if (typeof status !== "number") return;

    const eventType = eventForStatusTransition(this.lastRaceStatus, status);
    const prev = this.lastRaceStatus;
    this.lastRaceStatus = status;

    if (status === RaceStatus.STAGING) {
      this.lapCounts = [];
    }

    if (!eventType) {
      if (prev !== status) {
        console.debug(
          `[rotorhazard-adapter] race_status ${prev ?? "?"} → ${status} (no gate event)`,
        );
      }
      return;
    }

    console.log(
      `[rotorhazard-adapter] race_status ${prev ?? "?"} → ${status} → ${eventType}`,
    );
    this.emitHeatEvent(eventType);
  }

  private handleCurrentHeat(payload: CurrentHeatPayload) {
    const heatId = payload.current_heat;
    if (heatId == null) return;

    this.heatNodes.clear();
    if (payload.heatNodes) {
      for (const [index, slot] of Object.entries(payload.heatNodes)) {
        this.heatNodes.set(Number(index), slot);
      }
    }

    if (heatId === this.currentHeatId) return;
    this.currentHeatId = heatId;
    this.lapCounts = [];

    const pilots: Pilot[] = [];
    for (const [seat, slot] of this.heatNodes) {
      if (!slot.pilot_id && !slot.callsign) continue;
      const color = parseRhColor(
        slot.pilotColor ?? slot.heatNodeColor ?? slot.activeColor,
      );
      pilots.push({
        id: String(slot.pilot_id ?? `seat-${seat}`),
        name: slot.callsign ?? `Seat ${seat + 1}`,
        color,
        seat,
      });
    }

    console.log(
      `[rotorhazard-adapter] current_heat ${heatId} → heat.loaded (${pilots.length} pilots)`,
    );
    this.callbacks.onEvent({
      type: "heat.loaded",
      heat: {
        id: String(heatId),
        round: payload.next_round ?? undefined,
      },
      pilots,
    });
  }

  private handleCurrentLaps(payload: CurrentLapsPayload) {
    if (this.lastRaceStatus !== RaceStatus.RACING) return;

    const nodes = payload.current?.node_index;
    if (!Array.isArray(nodes)) return;

    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      const node = nodes[nodeIndex];
      const laps = node.laps ?? [];
      const prevCount = this.lapCounts[nodeIndex] ?? 0;

      if (laps.length <= prevCount) {
        this.lapCounts[nodeIndex] = laps.length;
        continue;
      }

      const latestLap = laps[laps.length - 1];
      const lapNumber =
        typeof latestLap?.lap_number === "number"
          ? latestLap.lap_number + 1
          : laps.length;

      console.log(
        `[rotorhazard-adapter] current_laps node ${nodeIndex} lap ${lapNumber} → pilot.crossing`,
      );
      this.callbacks.onEvent({
        type: "pilot.crossing",
        pilot: this.pilotForNode(nodeIndex, node),
        crossing: {
          lap: lapNumber,
          timestamp: latestLap?.lap_time_stamp,
          node: String(nodeIndex),
        },
        heat: this.heat(),
      });

      this.lapCounts[nodeIndex] = laps.length;
    }
  }

  private emitHeatEvent(
    type: "heat.arm_started" | "heat.go" | "heat.finished",
  ) {
    this.callbacks.onEvent({ type, heat: this.heat() });
  }

  private heat() {
    return {
      id:
        this.currentHeatId != null ? String(this.currentHeatId) : "rotorhazard",
    };
  }

  private pilotForNode(nodeIndex: number, lapNode?: LapNode): Pilot {
    const slot = this.heatNodes.get(nodeIndex);
    const lapPilot = lapNode?.pilot;

    const color = parseRhColor(
      lapPilot?.color ??
        slot?.pilotColor ??
        slot?.heatNodeColor ??
        this.nodeColors[nodeIndex] ??
        slot?.activeColor,
    );

    return {
      id: String(lapPilot?.id ?? slot?.pilot_id ?? `node-${nodeIndex}`),
      name: lapPilot?.callsign ?? slot?.callsign ?? `Seat ${nodeIndex + 1}`,
      color,
      seat: nodeIndex,
    };
  }
}
