import fs from "node:fs";
import path from "node:path";
import {
  type Config,
  configSchema,
  type EventSequence,
  eventSequenceSchema,
  type Gate,
} from "./schema";

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const configPath =
  process.env.GATESTAGE_CONFIG_PATH ?? path.join(dataDir, "config.json");
const configTmpPath = `${configPath}.tmp`;

let cached: Config | null = null;
let cachedMtimeMs: number | null = null;

function configMtimeMs(): number | null {
  try {
    return fs.statSync(configPath).mtimeMs;
  } catch {
    return null;
  }
}

/** Always prefer disk when it changed — avoids stale module caches overwriting sequences. */
function loadConfigFromDisk(): Config {
  if (!fs.existsSync(configPath)) {
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

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = configSchema.parse(JSON.parse(raw));
  cached = parsed;
  cachedMtimeMs = mtimeMs;
  return parsed;
}

function defaultConfig(): Config {
  const nextWsUrl = process.env.NEXT_WS_URL ?? "ws://127.0.0.1:9400";

  return {
    version: 2,
    settings: {
      raceManagerProvider: "next",
      nextWsUrl,
      rotorHazardUrl:
        process.env.ROTORHAZARD_URL ?? "http://rotorhazard.local:5000",
      defaultBrightnessPercent: 5,
    },
    gates: [],
    sequences: [],
  };
}

function writeConfigFile(config: Config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(configTmpPath, json, "utf8");
  fs.renameSync(configTmpPath, configPath);
}

export function initConfig(): Config {
  return loadConfigFromDisk();
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
  source: "mdns" | "env";
};

const DISCOVERY_MAX_MISSED_SCANS = Number(
  process.env.GATESTAGE_DISCOVERY_MAX_MISSES ?? 3,
);

/** Last-known gate metadata — survives brief discovery dropouts. */
const lastKnownById = new Map<string, Gate>();
const missedScansById = new Map<string, number>();
let rememberedStartGateId: string | null = null;

function syncRememberedStartGateFromGates(gates: Gate[]) {
  const start = gates.find((g) => g.isStartGate);
  if (start) rememberedStartGateId = start.id;
}

function snapshotGates(gates: Gate[]) {
  for (const gate of gates) {
    lastKnownById.set(gate.id, structuredClone(gate));
  }
  syncRememberedStartGateFromGates(gates);
}

/** Called when the user explicitly sets the start gate in the UI. */
export function rememberStartGateId(id: string) {
  rememberedStartGateId = id;
}

export function mergeDiscoveredGates(
  discovered: DiscoveredGateSummary[],
): MergeDiscoveryResult {
  const previous = getGates();
  snapshotGates(previous);

  const discoveredIds = new Set(discovered.map((d) => d.id));
  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];

  const maxSortOrder = previous.reduce(
    (max, gate) => Math.max(max, gate.sortOrder),
    -1,
  );
  let nextSortOrder = maxSortOrder + 1;

  const merged = new Map<string, Gate>();

  for (const item of discovered) {
    const existing =
      previous.find((g) => g.id === item.id) ?? lastKnownById.get(item.id);

    if (existing) {
      if (!previous.some((g) => g.id === item.id)) {
        added.push(item.id);
      } else if (existing.host !== item.host) {
        updated.push(item.id);
      }
      merged.set(item.id, { ...existing, host: item.host });
      missedScansById.set(item.id, 0);
      continue;
    }

    added.push(item.id);
    merged.set(item.id, {
      id: item.id,
      host: item.host,
      isStartGate: false,
      enabled: true,
      sortOrder: nextSortOrder,
    });
    nextSortOrder += 1;
    missedScansById.set(item.id, 0);
  }

  for (const gate of previous) {
    if (discoveredIds.has(gate.id)) continue;

    const misses = (missedScansById.get(gate.id) ?? 0) + 1;
    missedScansById.set(gate.id, misses);

    if (misses < DISCOVERY_MAX_MISSED_SCANS) {
      merged.set(gate.id, gate);
    } else {
      removed.push(gate.id);
      missedScansById.delete(gate.id);
    }
  }

  let gates = [...merged.values()];

  if (
    rememberedStartGateId &&
    gates.some((g) => g.id === rememberedStartGateId)
  ) {
    gates = gates.map((g) => ({
      ...g,
      isStartGate: g.id === rememberedStartGateId,
    }));
  } else if (gates.length > 0 && !gates.some((g) => g.isStartGate)) {
    const first = [...gates].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    gates = gates.map((g) =>
      g.id === first?.id ? { ...g, isStartGate: true } : g,
    );
    if (first) rememberedStartGateId = first.id;
  }

  saveConfig((config) => ({
    ...config,
    gates,
  }));

  snapshotGates(gates);

  return {
    discovered,
    added,
    updated,
    removed,
    gates: getGates(),
  };
}
