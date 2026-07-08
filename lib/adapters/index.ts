import type { IntegrationId } from "@/lib/integrations";
import { NextAdapter } from "./next-adapter";
import { RotorHazardAdapter } from "./rotorhazard-adapter";
import type {
  AdapterCallbacks,
  AdapterConfig,
  RaceManagerAdapter,
} from "./types";

export type { AdapterCallbacks, AdapterConfig, RaceManagerAdapter };

/**
 * Build the adapter for the selected provider. Returns `null` for providers
 * without an implementation yet (e.g. FPV Trackside), so the listener can
 * report "not connected" without crashing.
 */
export function createAdapter(
  provider: IntegrationId,
  config: AdapterConfig,
  callbacks: AdapterCallbacks,
): RaceManagerAdapter | null {
  switch (provider) {
    case "next":
      return new NextAdapter(config.nextWsUrl, callbacks);
    case "rotorhazard":
      return new RotorHazardAdapter(config.rotorHazardUrl, callbacks);
    default:
      return null;
  }
}
