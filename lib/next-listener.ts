import WebSocket from "ws";
import type { Broadcaster } from "./broadcaster";
import { getSetting } from "./config/store";
import type { GateEngine } from "./gate-engine";
import {
  raceEventSchema,
  type RaceEvent,
  type RaceEventEnvelope,
} from "./types";

type NextListenerOptions = {
  url?: string;
  reconnectMs?: number;
};

export class NextListener {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private url: string;
  private connected = false;

  constructor(
    private gateEngine: GateEngine,
    private broadcaster: Broadcaster,
    options: NextListenerOptions = {},
  ) {
    this.url =
      options.url ??
      process.env.NEXT_WS_URL ??
      getSetting("nextWsUrl") ??
      "ws://127.0.0.1:9400";
  }

  isConnected() {
    return this.connected;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.broadcaster.emitNextConnection(false);
  }

  private connect() {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error("[next-listener] connect failed:", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      console.log("[next-listener] connected to", this.url);
      this.connected = true;
      this.broadcaster.emitNextConnection(true);
    });

    this.ws.on("message", (data) => {
      void this.handleMessage(data.toString());
    });

    this.ws.on("close", () => {
      console.log("[next-listener] disconnected");
      this.connected = false;
      this.broadcaster.emitNextConnection(false);
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[next-listener] error:", err.message);
    });
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 3000);
  }

  private async handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[next-listener] invalid JSON:", raw.slice(0, 200));
      return;
    }

    const result = raceEventSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("[next-listener] invalid event:", result.error.message);
      return;
    }

    const event: RaceEvent = result.data;
    const envelope: RaceEventEnvelope = {
      type: event.type,
      payload: event,
      at: new Date().toISOString(),
    };

    this.broadcaster.emitRaceEvent(envelope);
    await this.gateEngine.dispatch(event);
  }
}
