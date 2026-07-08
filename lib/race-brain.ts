import { broadcaster } from "./broadcaster";
import { initConfig, reloadConfig } from "./config/store";
import { syncGatesFromNetwork } from "./gate-discovery";
import { GateEngine } from "./gate-engine";
import { RaceManagerListener } from "./race-manager-listener";

const GLOBAL_BRAIN_KEY = "__gatestage_race_brain__";

type BrainState = {
  gateEngine: GateEngine | null;
  raceManagerListener: RaceManagerListener | null;
  initialized: boolean;
  discoveryTimer: NodeJS.Timeout | null;
};

const DISCOVERY_INTERVAL_MS = Number(
  process.env.GATESTAGE_DISCOVERY_INTERVAL_MS ?? 15_000,
);

function brainState(): BrainState {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_BRAIN_KEY]?: BrainState;
  };
  if (!globalStore[GLOBAL_BRAIN_KEY]) {
    globalStore[GLOBAL_BRAIN_KEY] = {
      gateEngine: null,
      raceManagerListener: null,
      initialized: false,
      discoveryTimer: null,
    };
  }
  return globalStore[GLOBAL_BRAIN_KEY];
}

export function getRaceBrain() {
  const state = brainState();
  if (!state.gateEngine) {
    state.gateEngine = new GateEngine(broadcaster);
  }
  return {
    gateEngine: state.gateEngine,
    broadcaster,
    raceManagerListener: state.raceManagerListener,
  };
}

async function runGateDiscovery() {
  try {
    const result = await syncGatesFromNetwork();

    if (
      result.added.length > 0 ||
      result.updated.length > 0 ||
      result.removed.length > 0
    ) {
      console.log(
        `[discovery] added=${result.added.join(",") || "none"} updated=${result.updated.join(",") || "none"} removed=${result.removed.join(",") || "none"}`,
      );
      broadcaster.emitConfigUpdated();
    }
  } catch (err) {
    console.error("[discovery] failed:", err);
  }
}

export function initRaceBrain() {
  const state = brainState();
  if (state.initialized) return getRaceBrain();
  state.initialized = true;

  initConfig();
  reloadConfig();
  const brain = getRaceBrain();
  state.raceManagerListener = new RaceManagerListener(
    brain.gateEngine,
    broadcaster,
  );
  state.raceManagerListener.start();

  void runGateDiscovery();
  state.discoveryTimer = setInterval(() => {
    void runGateDiscovery();
  }, DISCOVERY_INTERVAL_MS);

  console.log("[race-brain] initialized");
  return getRaceBrain();
}

export function shutdownRaceBrain() {
  const state = brainState();
  state.raceManagerListener?.stop();
  state.raceManagerListener = null;
  if (state.discoveryTimer) clearInterval(state.discoveryTimer);
  state.discoveryTimer = null;
  state.initialized = false;
}

/** Re-read config and reconnect the active race-manager adapter (e.g. after Settings save). */
export function reloadRaceManagerListener() {
  const state = brainState();
  const brain = getRaceBrain();
  if (!state.raceManagerListener) {
    state.raceManagerListener = new RaceManagerListener(
      brain.gateEngine,
      broadcaster,
    );
    reloadConfig();
    state.raceManagerListener.start();
    return;
  }
  state.raceManagerListener.restart();
}
