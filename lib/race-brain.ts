import { broadcaster } from "./broadcaster";
import { initConfig, reloadConfig } from "./config/store";
import { syncGatesFromNetwork } from "./gate-discovery";
import { GateEngine } from "./gate-engine";
import { startPresence, stopPresence } from "./gate-presence";
import { logger } from "./logger";
import { RaceManagerListener } from "./race-manager-listener";

const GLOBAL_BRAIN_KEY = "__gatestage_race_brain__";

type BrainState = {
  gateEngine: GateEngine | null;
  raceManagerListener: RaceManagerListener | null;
  initialized: boolean;
};

function brainState(): BrainState {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_BRAIN_KEY]?: BrainState;
  };
  if (!globalStore[GLOBAL_BRAIN_KEY]) {
    globalStore[GLOBAL_BRAIN_KEY] = {
      gateEngine: null,
      raceManagerListener: null,
      initialized: false,
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

  startPresence();
  void syncGatesFromNetwork().catch((err) => {
    logger.error("discovery", "initial scan failed", err);
  });

  logger.info("race-brain", "initialized");
  return getRaceBrain();
}

export function shutdownRaceBrain() {
  logger.info("race-brain", "shutting down");
  const state = brainState();
  state.raceManagerListener?.stop();
  state.raceManagerListener = null;
  stopPresence();
  state.initialized = false;
}

/** Re-read config and reconnect the active race-manager adapter (e.g. after Settings save). */
export function reloadRaceManagerListener() {
  logger.info("race-manager", "reloading listener from settings");
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
