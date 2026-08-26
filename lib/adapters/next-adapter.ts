import WebSocket from "ws";
import { logger } from "@/lib/logger";
import { translateNextMessage } from "./next-events";
import type { AdapterCallbacks, RaceManagerAdapter } from "./types";

const RECONNECT_MS = 3000;

/**
 * Next race director adapter.
 *
 * Next broadcasts race events over a raw WebSocket (`ws://localhost:5702`) in
 * its own wire format (`arm` / `start` / `finish` / `lastcall` / `pilot`).
 * This adapter translates those envelopes into the shared race-event model.
 * Other providers (RotorHazard, Trackside) have their own translators.
 */
export class NextAdapter implements RaceManagerAdapter {
  readonly provider = "next" as const;

  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private connected = false;

  constructor(
    private url: string,
    private callbacks: AdapterCallbacks,
  ) {}

  isConnected() {
    return this.connected;
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.removeAllListeners();
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    }
    this.setConnected(false);
  }

  private setConnected(connected: boolean) {
    this.connected = connected;
    this.callbacks.onConnectionChange(connected);
  }

  private connect() {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      logger.error("next-adapter", "connect failed", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      logger.info("next-adapter", `connected to ${this.url}`);
      this.setConnected(true);
    });

    this.ws.on("message", (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on("close", () => {
      if (this.stopped) return;
      logger.info("next-adapter", "disconnected");
      this.setConnected(false);
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      if (this.stopped) return;
      logger.error("next-adapter", `error: ${err.message}`);
    });
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.warn("next-adapter", `invalid JSON: ${raw.slice(0, 200)}`);
      return;
    }

    const event = translateNextMessage(parsed);
    if (!event) {
      logger.warn("next-adapter", `unrecognized event: ${raw.slice(0, 200)}`);
      return;
    }

    this.callbacks.onEvent(event);
  }
}
