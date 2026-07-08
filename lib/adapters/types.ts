import type { IntegrationId } from "@/lib/integrations";
import type { RaceEvent } from "@/lib/types";

/**
 * Callbacks an adapter uses to push normalized data back to the
 * RaceManagerListener. Adapters translate their native race-manager protocol
 * into the shared {@link RaceEvent} model; everything downstream (broadcast to
 * browsers, gate automation) is provider-agnostic.
 */
export type AdapterCallbacks = {
  /** Emit a normalized race event (validated by the listener before dispatch). */
  onEvent: (event: RaceEvent) => void;
  /** Report transport connection state so the UI can show a live indicator. */
  onConnectionChange: (connected: boolean) => void;
};

/** Connection details resolved from settings, passed to each adapter. */
export type AdapterConfig = {
  /** Next race director WebSocket URL. */
  nextWsUrl: string;
  /** RotorHazard server URL (Socket.io), e.g. http://rotorhazard.local:5000. */
  rotorHazardUrl: string;
};

/**
 * A race-manager integration. Owns its own transport (raw WS, Socket.io, etc.)
 * and lifecycle. One adapter instance is active at a time, chosen by the
 * `raceManagerProvider` setting.
 */
export interface RaceManagerAdapter {
  readonly provider: IntegrationId;
  start(): void;
  stop(): void;
  isConnected(): boolean;
}
