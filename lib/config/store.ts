import fs from "node:fs";
import path from "node:path";
import {
  type Config,
  configSchema,
  type EventSequence,
  type Gate,
} from "./schema";

const dataDir = path.join(process.cwd(), "data");
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
    settings: { nextWsUrl, defaultBrightnessPercent: 5 },
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

export function mergeDiscoveredGates(
  discovered: DiscoveredGateSummary[],
): MergeDiscoveryResult {
  const previous = getGates();
  const discoveredIds = new Set(discovered.map((d) => d.id));
  const added: string[] = [];
  const updated: string[] = [];
  const removed = previous
    .filter((g) => !discoveredIds.has(g.id))
    .map((g) => g.id);

  const maxSortOrder = previous.reduce(
    (max, gate) => Math.max(max, gate.sortOrder),
    -1,
  );
  let nextSortOrder = maxSortOrder + 1;

  saveConfig((config) => {
    let gates: Gate[] = discovered.map((item) => {
      const existing = previous.find((g) => g.id === item.id);
      if (existing) {
        if (existing.host !== item.host) updated.push(item.id);
        return { ...existing, host: item.host };
      }

      added.push(item.id);
      const gate: Gate = {
        id: item.id,
        host: item.host,
        isStartGate: false,
        enabled: true,
        sortOrder: nextSortOrder,
      };
      nextSortOrder += 1;
      return gate;
    });

    if (gates.length > 0 && !gates.some((g) => g.isStartGate)) {
      const first = [...gates].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      gates = gates.map((g) =>
        g.id === first?.id ? { ...g, isStartGate: true } : g,
      );
    }

    return { ...config, gates };
  });

  return {
    discovered,
    added,
    updated,
    removed,
    gates: getGates(),
  };
}
