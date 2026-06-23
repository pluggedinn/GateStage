import type { Server as SocketServer, Socket } from "socket.io";
import type { RaceActionEnvelope, RaceEventEnvelope } from "./types";

const BUFFER_LIMIT = 100;

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

  emitNextConnection(connected: boolean) {
    this.io?.emit("connection:next", { nextConnected: connected });
  }
}

export const broadcaster = new Broadcaster(null);
