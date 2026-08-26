import { createAdapter, type RaceManagerAdapter } from "./adapters";
import type { Broadcaster } from "./broadcaster";
import { getSetting, reloadConfig } from "./config/store";
import type { GateEngine } from "./gate-engine";
import {
  getIntegration,
  type IntegrationId,
  type RaceManagerConnectionState,
} from "./integrations";
import { logger } from "./logger";
import type { RaceEvent, RaceEventEnvelope } from "./types";

/**
 * Coordinates the active race-manager integration. Picks an adapter based on the
 * `raceManagerProvider` setting, then fans normalized {@link RaceEvent}s out to
 * the UI (broadcaster) and gate automation (gate engine). Provider-specific
 * protocol handling lives in the adapters under `lib/adapters/`.
 */
export class RaceManagerListener {
  private adapter: RaceManagerAdapter | null = null;
  private provider: IntegrationId;
  private connected = false;

  constructor(
    private gateEngine: GateEngine,
    private broadcaster: Broadcaster,
  ) {
    this.provider = getSetting("raceManagerProvider");
  }

  getProvider(): IntegrationId {
    return this.provider;
  }

  getConnectionState(): RaceManagerConnectionState {
    const integration = getIntegration(this.provider);
    return {
      provider: this.provider,
      connected: this.connected,
      status: integration?.status ?? "wip",
    };
  }

  isConnected() {
    return this.connected;
  }

  start() {
    this.provider = getSetting("raceManagerProvider");
    logger.info("race-manager", `starting provider "${this.provider}"`);

    const config = {
      nextWsUrl:
        process.env.NEXT_WS_URL ??
        getSetting("nextWsUrl") ??
        "ws://127.0.0.1:9400",
      rotorHazardUrl:
        getSetting("rotorHazardUrl") ?? "http://rotorhazard.local:5000",
    };

    this.adapter = createAdapter(this.provider, config, {
      onEvent: (event) => this.handleEvent(event),
      onConnectionChange: (connected) => this.setConnected(connected),
    });

    if (!this.adapter) {
      logger.info(
        "race-manager",
        `provider "${this.provider}" is not yet implemented`,
      );
      this.emitConnectionState();
      return;
    }

    this.adapter.start();
  }

  stop() {
    this.adapter?.stop();
    this.adapter = null;
    this.connected = false;
  }

  restart() {
    const previous = this.provider;
    this.stop();
    reloadConfig();
    this.start();
    this.emitConnectionState();
    logger.info("race-manager", `restarted ${previous} → ${this.provider}`);
  }

  private setConnected(connected: boolean) {
    if (this.connected !== connected) {
      logger.info(
        "race-manager",
        connected
          ? `connected provider="${this.provider}"`
          : `disconnected provider="${this.provider}"`,
      );
    }
    this.connected = connected;
    this.emitConnectionState();
  }

  private emitConnectionState() {
    this.broadcaster.emitRaceManagerConnection(this.getConnectionState());
  }

  private handleEvent(event: RaceEvent) {
    const envelope: RaceEventEnvelope = {
      type: event.type,
      payload: event,
      at: new Date().toISOString(),
    };

    logger.info("race-manager", `event ${event.type}`, event);

    this.broadcaster.emitRaceEvent(envelope);
    void this.gateEngine.dispatch(event);
  }
}
