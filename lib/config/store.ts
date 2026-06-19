import fs from "node:fs";
import path from "node:path";
import {
  type Config,
  type EventMapping,
  type Gate,
  configSchema,
} from "./schema";

const dataDir = path.join(process.cwd(), "data");
const configPath =
  process.env.GATESTAGE_CONFIG_PATH ?? path.join(dataDir, "config.json");
const configTmpPath = `${configPath}.tmp`;

let cached: Config | null = null;

function defaultConfig(): Config {
  const nextWsUrl =
    process.env.NEXT_WS_URL ?? "ws://127.0.0.1:9400";

  return {
    version: 1,
    settings: { nextWsUrl, defaultBrightnessPercent: 5 },
    gates: [],
    mappings: [
      {
        id: "map-heat-loaded",
        eventType: "heat.loaded",
        target: "start_gate",
        targetGateId: null,
        action: { kind: "pilot_color" },
        enabled: true,
      },
      {
        id: "map-arm-started",
        eventType: "heat.arm_started",
        target: "start_gate",
        targetGateId: null,
        action: { kind: "effect", effectId: "pulse" },
        enabled: true,
      },
      {
        id: "map-heat-go",
        eventType: "heat.go",
        target: "all",
        targetGateId: null,
        action: { kind: "solid", r: 0, g: 255, b: 0 },
        enabled: true,
      },
      {
        id: "map-heat-finished",
        eventType: "heat.finished",
        target: "all",
        targetGateId: null,
        action: { kind: "solid", r: 255, g: 0, b: 0 },
        enabled: true,
      },
      {
        id: "map-pilot-crossing",
        eventType: "pilot.crossing",
        target: "start_gate",
        targetGateId: null,
        action: { kind: "pilot_color" },
        enabled: true,
      },
    ],
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
  if (cached) return cached;

  if (!fs.existsSync(configPath)) {
    const seeded = defaultConfig();
    writeConfigFile(seeded);
    cached = seeded;
    return cached;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = configSchema.parse(JSON.parse(raw));
  cached = parsed;
  return cached;
}

export function getConfig(): Config {
  return cached ?? initConfig();
}

export function reloadConfig(): Config {
  cached = null;
  return initConfig();
}

export function saveConfig(mutator: (config: Config) => Config): Config {
  const current = getConfig();
  const next = configSchema.parse(mutator(structuredClone(current)));
  writeConfigFile(next);
  cached = next;
  return next;
}

export function getGates(): Gate[] {
  return [...getConfig().gates].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getGate(id: string): Gate | undefined {
  return getConfig().gates.find((g) => g.id === id);
}

export function getMappings(): EventMapping[] {
  return getConfig().mappings;
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
  const added: string[] = [];
  const updated: string[] = [];

  saveConfig((config) => {
    const gates = [...config.gates];

    for (const item of discovered) {
      const idx = gates.findIndex((g) => g.id === item.id);
      if (idx >= 0) {
        if (gates[idx].host !== item.host) {
          gates[idx] = { ...gates[idx], host: item.host };
          updated.push(item.id);
        }
        continue;
      }

      const shouldBeStart = !gates.some((g) => g.isStartGate);
      gates.push({
        id: item.id,
        host: item.host,
        isStartGate: shouldBeStart,
        enabled: true,
        sortOrder: gates.length,
      });
      added.push(item.id);
    }

    return { ...config, gates };
  });

  return {
    discovered,
    added,
    updated,
    gates: getGates(),
  };
}
