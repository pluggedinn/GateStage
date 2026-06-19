import { broadcaster } from "./broadcaster";
import { initConfig, mergeDiscoveredGates } from "./config/store";
import { discoverGates } from "./gate-discovery";
import { GateEngine } from "./gate-engine";
import { NextListener } from "./next-listener";

let gateEngine: GateEngine | null = null;
let nextListener: NextListener | null = null;
let initialized = false;
let discoveryTimer: NodeJS.Timeout | null = null;

const DISCOVERY_INTERVAL_MS = Number(
  process.env.GATESTAGE_DISCOVERY_INTERVAL_MS ?? 60_000,
);

export function getRaceBrain() {
  if (!gateEngine) {
    gateEngine = new GateEngine(broadcaster);
  }
  return { gateEngine, broadcaster, nextListener };
}

async function runGateDiscovery() {
  try {
    const discovered = await discoverGates();
    const result = mergeDiscoveredGates(discovered);

    if (result.added.length > 0 || result.updated.length > 0) {
      console.log(
        `[discovery] added=${result.added.join(",") || "none"} updated=${result.updated.join(",") || "none"}`,
      );
      broadcaster.emitConfigUpdated();
    }
  } catch (err) {
    console.error("[discovery] failed:", err);
  }
}

export function initRaceBrain() {
  if (initialized) return getRaceBrain();
  initialized = true;

  initConfig();
  const brain = getRaceBrain();
  nextListener = new NextListener(brain.gateEngine, broadcaster);
  nextListener.start();

  void runGateDiscovery();
  discoveryTimer = setInterval(() => {
    void runGateDiscovery();
  }, DISCOVERY_INTERVAL_MS);

  console.log("[race-brain] initialized");
  return brain;
}

export function shutdownRaceBrain() {
  nextListener?.stop();
  nextListener = null;
  if (discoveryTimer) clearInterval(discoveryTimer);
  discoveryTimer = null;
}
