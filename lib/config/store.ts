import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";
import {
  type Config,
  configSchema,
  type EventSequence,
  eventSequenceSchema,
  type Gate,
} from "./schema";

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");

function resolveConfigPath() {
  return process.env.GATESTAGE_CONFIG_PATH ?? path.join(dataDir, "config.json");
}

function resolveConfigTmpPath() {
  return `${resolveConfigPath()}.tmp`;
}

let cached: Config | null = null;
let cachedMtimeMs: number | null = null;

function configMtimeMs(): number | null {
  try {
    return fs.statSync(resolveConfigPath()).mtimeMs;
  } catch {
    return null;
  }
}

/** Always prefer disk when it changed — avoids stale module caches overwriting sequences. */
function loadConfigFromDisk(): Config {
  if (!fs.existsSync(resolveConfigPath())) {
    const seeded = defaultConfig();
    writeConfigFile(seeded);
    cached = seeded;
    cachedMtimeMs = configMtimeMs();
    return seeded;
  }

  const mtimeMs = configMtimeMs();
  if (cached && cachedMtimeMs === mtimeMs) {
    return cached;
  }

  const raw = fs.readFileSync(resolveConfigPath(), "utf8");
  const parsed = configSchema.parse(JSON.parse(raw));
  cached = parsed;
  cachedMtimeMs = mtimeMs;
  return parsed;
}

function defaultConfig(): Config {
  return {
    version: 2,
    settings: {
      raceManagerProvider: "next",
      nextWsUrl: "ws://127.0.0.1:9400",
      rotorHazardUrl: "http://rotorhazard.local:5000",
      defaultBrightnessPercent: 5,
    },
    gates: [],
    sequences: [],
  };
}

function writeConfigFile(config: Config) {
  const configPath = resolveConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const json = JSON.stringify(config, null, 2);
  const tmpPath = resolveConfigTmpPath();
  fs.writeFileSync(tmpPath, json, "utf8");
  fs.renameSync(tmpPath, configPath);
}

export function initConfig(): Config {
  const config = loadConfigFromDisk();
  snapshotGates(config.gates);
  return config;
}

export function getConfig(): Config {
  return loadConfigFromDisk();
}

export function reloadConfig(): Config {
  cached = null;
  cachedMtimeMs = null;
  return loadConfigFromDisk();
}

export function saveConfig(mutator: (config: Config) => Config): Config {
  const current = loadConfigFromDisk();
  const next = configSchema.parse(mutator(structuredClone(current)));
  writeConfigFile(next);
  cached = next;
  cachedMtimeMs = configMtimeMs();
  return next;
}

export function getGates(): Gate[] {
  return [...getConfig().gates].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getGate(id: string): Gate | undefined {
  return getConfig().gates.find((g) => g.id === id);
}

export function reorderGates(orderedIds: string[]): Gate[] {
  const current = getGates();
  const currentIds = new Set(current.map((g) => g.id));
  const orderedSet = new Set(orderedIds);

  if (orderedIds.length !== current.length) {
    throw new Error("orderedIds must include every gate exactly once");
  }
  if (orderedIds.length !== orderedSet.size) {
    throw new Error("orderedIds must not contain duplicates");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      throw new Error(`Unknown gate id: ${id}`);
    }
  }

  saveConfig((config) => {
    const byId = new Map(config.gates.map((g) => [g.id, g]));
    const gates = orderedIds.map((id, sortOrder) => {
      const gate = byId.get(id);
      if (!gate) throw new Error(`Unknown gate id: ${id}`);
      return { ...gate, sortOrder };
    });
    return { ...config, gates };
  });

  return getGates();
}

export function getSequences(): EventSequence[] {
  return getConfig().sequences;
}

export function getSequence(eventType: string): EventSequence | undefined {
  return getConfig().sequences.find((s) => s.eventType === eventType);
}

export function reorderSequenceSteps(
  eventType: string,
  orderedIds: string[],
): EventSequence {
  const sequence = getSequence(eventType);
  if (!sequence) {
    throw new Error("Routine not found");
  }

  const currentIds = new Set(sequence.steps.map((s) => s.id));
  const orderedSet = new Set(orderedIds);

  if (orderedIds.length !== sequence.steps.length) {
    throw new Error("orderedIds must include every step exactly once");
  }
  if (orderedIds.length !== orderedSet.size) {
    throw new Error("orderedIds must not contain duplicates");
  }
  for (const id of orderedIds) {
    if (!currentIds.has(id)) {
      throw new Error(`Unknown step id: ${id}`);
    }
  }

  saveConfig((config) => {
    const byId = new Map(sequence.steps.map((s) => [s.id, s]));
    const steps = orderedIds.map((id) => {
      const step = byId.get(id);
      if (!step) throw new Error(`Unknown step id: ${id}`);
      return step;
    });

    return {
      ...config,
      sequences: config.sequences.map((s) =>
        s.eventType === eventType
          ? eventSequenceSchema.parse({ ...s, steps })
          : s,
      ),
    };
  });

  const updated = getSequence(eventType);
  if (!updated) throw new Error("Routine not found");
  return updated;
}

export function getSetting<K extends keyof Config["settings"]>(
  key: K,
): Config["settings"][K] {
  return getConfig().settings[key];
}

export function setSetting<K extends keyof Config["settings"]>(
  key: K,
  value: Config["settings"][K],
) {
  saveConfig((config) => ({
    ...config,
    settings: { ...config.settings, [key]: value },
  }));
}

export function getDefaultBrightnessPercent(): number {
  return getConfig().settings.defaultBrightnessPercent;
}

export type MergeDiscoveryResult = {
  discovered: DiscoveredGateSummary[];
  added: string[];
  updated: string[];
  removed: string[];
  gates: Gate[];
};

export type DiscoveredGateSummary = {
  id: string;
  host: string;
  source: "udp" | "env";
};

/** Last-known gate metadata — used if a forgotten id beacons again as a new row. */
const GLOBAL_DISCOVERY_KEY = "__gatestage_gate_discovery__";

type DiscoveryMemory = {
  lastKnownById: Map<string, Gate>;
  rememberedStartGateId: string | null;
};

function discoveryMemory(): DiscoveryMemory {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_DISCOVERY_KEY]?: DiscoveryMemory;
  };
  if (!globalStore[GLOBAL_DISCOVERY_KEY]) {
    globalStore[GLOBAL_DISCOVERY_KEY] = {
      lastKnownById: new Map(),
      rememberedStartGateId: null,
    };
  }
  return globalStore[GLOBAL_DISCOVERY_KEY];
}

function syncRememberedStartGateFromGates(gates: Gate[]) {
  const mem = discoveryMemory();
  const start = gates.find((g) => g.isStartGate);
  mem.rememberedStartGateId = start?.id ?? mem.rememberedStartGateId;
}

function snapshotGates(gates: Gate[]) {
  const mem = discoveryMemory();
  mem.lastKnownById.clear();
  for (const gate of gates) {
    mem.lastKnownById.set(gate.id, structuredClone(gate));
  }
  syncRememberedStartGateFromGates(gates);
}

function startFlagsEqual(a: Gate[], b: Gate[]): boolean {
  if (a.length !== b.length) return false;
  const bById = new Map(b.map((g) => [g.id, g]));
  for (const gate of a) {
    if (gate.isStartGate !== Boolean(bById.get(gate.id)?.isStartGate)) {
      return false;
    }
  }
  return true;
}

/** Called when the user explicitly sets or clears the start gate in the UI. */
export function rememberStartGateId(id: string | null) {
  discoveryMemory().rememberedStartGateId = id;
}

/** Test helper — clears in-memory discovery state. */
export function resetDiscoveryMemory() {
  const mem = discoveryMemory();
  mem.lastKnownById.clear();
  mem.rememberedStartGateId = null;
  cached = null;
  cachedMtimeMs = null;
}

export function forgetGate(id: string): Gate[] {
  const existing = getGate(id);
  if (!existing) {
    throw new Error("Gate not found");
  }

  const mem = discoveryMemory();
  mem.lastKnownById.delete(id);
  const wasStart = existing.isStartGate || mem.rememberedStartGateId === id;

  saveConfig((config) => {
    let gates = config.gates.filter((g) => g.id !== id);
    if (wasStart && gates.length > 0 && !gates.some((g) => g.isStartGate)) {
      const first = [...gates].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (first) {
        gates = gates.map((g) => ({
          ...g,
          isStartGate: g.id === first.id,
        }));
        mem.rememberedStartGateId = first.id;
      }
    } else if (wasStart && gates.length === 0) {
      mem.rememberedStartGateId = null;
    }
    return { ...config, gates };
  });

  const gates = getGates();
  snapshotGates(gates);
  return gates;
}

export function mergeDiscoveredGates(
  discovered: DiscoveredGateSummary[],
): MergeDiscoveryResult {
  const previous = getGates();
  snapshotGates(previous);
  const previousWasEmpty = previous.length === 0;
  const mem = discoveryMemory();

  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  const merged = new Map<string, Gate>();
  for (const gate of previous) {
    merged.set(gate.id, gate);
  }

  let nextSortOrder =
    previous.reduce((max, gate) => Math.max(max, gate.sortOrder), -1) + 1;

  for (const item of discovered) {
    const existing = merged.get(item.id) ?? mem.lastKnownById.get(item.id);

    if (existing) {
      if (!previous.some((g) => g.id === item.id)) {
        added.push(item.id);
        logger.info(
          "discovery",
          `added ${item.id} host=${item.host} (reappeared)`,
        );
      } else if (existing.host !== item.host) {
        updated.push(item.id);
        logger.info(
          "discovery",
          `updated ${item.id} host ${existing.host} → ${item.host}`,
        );
      }
      merged.set(item.id, { ...existing, host: item.host });
      continue;
    }

    added.push(item.id);
    logger.info(
      "discovery",
      `added ${item.id} host=${item.host} source=${item.source}`,
    );
    merged.set(item.id, {
      id: item.id,
      host: item.host,
      isStartGate: false,
      enabled: true,
      sortOrder: nextSortOrder,
    });
    nextSortOrder += 1;
  }

  let gates = [...merged.values()];

  if (
    mem.rememberedStartGateId &&
    gates.some((g) => g.id === mem.rememberedStartGateId)
  ) {
    gates = gates.map((g) => ({
      ...g,
      isStartGate: g.id === mem.rememberedStartGateId,
    }));
  } else if (
    previousWasEmpty &&
    gates.length > 0 &&
    !gates.some((g) => g.isStartGate)
  ) {
    const first = [...gates].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (first) {
      gates = gates.map((g) =>
        g.id === first.id ? { ...g, isStartGate: true } : g,
      );
      mem.rememberedStartGateId = first.id;
    }
  }

  const inventoryChanged =
    added.length > 0 || updated.length > 0 || !startFlagsEqual(previous, gates);

  if (inventoryChanged) {
    saveConfig((config) => ({
      ...config,
      gates,
    }));
  }

  snapshotGates(getGates());

  return {
    discovered,
    added,
    updated,
    removed,
    gates: getGates(),
  };
}
