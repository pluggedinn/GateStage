import type { Socket, Server as SocketServer } from "socket.io";
import type { RaceManagerConnectionState } from "./integrations";
import type { RaceActionEnvelope, RaceEventEnvelope } from "./types";

const BUFFER_LIMIT = 100;
const GLOBAL_BROADCASTER_KEY = "__gatestage_broadcaster__";

export class Broadcaster {
  private recentEvents: RaceEventEnvelope[] = [];
  private recentActions: RaceActionEnvelope[] = [];

  constructor(private io: SocketServer | null) {}

  setIo(io: SocketServer) {
    this.io = io;
  }

  emitRaceEvent(envelope: RaceEventEnvelope) {
    this.recentEvents = [envelope, ...this.recentEvents].slice(0, BUFFER_LIMIT);
    this.io?.emit("race:event", envelope);
  }

  emitRaceAction(envelope: RaceActionEnvelope) {
    this.recentActions = [envelope, ...this.recentActions].slice(
      0,
      BUFFER_LIMIT,
    );
    this.io?.emit("race:action", envelope);
  }

  /** Replay buffered feed to a client that just connected (new tab, refresh, reconnect). */
  replayRecent(socket: Socket) {
    for (const event of [...this.recentEvents].reverse()) {
      socket.emit("race:event", event);
    }
    for (const action of [...this.recentActions].reverse()) {
      socket.emit("race:action", action);
    }
  }

  emitConfigUpdated() {
    this.io?.emit("config:updated");
  }

  emitGateHealth(gateId: string, online: boolean) {
    this.io?.emit("gate:health", { gateId, online });
  }

  emitRaceManagerConnection(state: RaceManagerConnectionState) {
    this.io?.emit("connection:raceManager", state);
  }
}

/** Shared across server.ts and Next.js API routes (separate module instances in dev). */
function getBroadcaster(): Broadcaster {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_BROADCASTER_KEY]?: Broadcaster;
  };
  if (!globalStore[GLOBAL_BROADCASTER_KEY]) {
    globalStore[GLOBAL_BROADCASTER_KEY] = new Broadcaster(null);
  }
  return globalStore[GLOBAL_BROADCASTER_KEY];
}

export const broadcaster = getBroadcaster();
