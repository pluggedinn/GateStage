import type { Server as SocketServer } from "socket.io";
import type { RaceActionEnvelope, RaceEventEnvelope } from "./types";

export class Broadcaster {
  constructor(private io: SocketServer | null) {}

  setIo(io: SocketServer) {
    this.io = io;
  }

  emitRaceEvent(envelope: RaceEventEnvelope) {
    this.io?.emit("race:event", envelope);
  }

  emitRaceAction(envelope: RaceActionEnvelope) {
    this.io?.emit("race:action", envelope);
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
