import { percentToEsphome } from "@/lib/brightness";
import { getDefaultBrightnessPercent } from "@/lib/config/store";
import {
  EFFECT_BY_ID,
  EFFECT_BY_NAME,
  type EffectParamDef,
  mergeEffectParams,
} from "@/lib/effects";
import { logger } from "@/lib/logger";

/** ESPHome light entity name — fixed across all gates */
export const DEFAULT_LIGHT_ENTITY = "Gate LEDs";

export type EsphomeCommand =
  | {
      kind: "effect";
      effectId: string;
      params?: Record<string, number | boolean>;
      brightnessPercent?: number;
      r?: number;
      g?: number;
      b?: number;
    }
  | {
      kind: "rgb";
      r: number;
      g: number;
      b: number;
      brightnessPercent?: number;
    }
  | { kind: "off" };

/** Identify-flash duration. Override with `GATESTAGE_GATE_TEST_DURATION_MS`. */
export const GATE_TEST_DURATION_MS = 4_000;
const GATE_TEST_STROBE_PERIOD_MS = 80;
const GATE_TEST_STROBE_ON_MS = 40;
const GATE_TEST_BRIGHTNESS_PERCENT = 50;
const GATE_TEST_COLOR = { r: 255, g: 255, b: 255 } as const;
const STROBE_START_DELAY_KEY = "start_delay_ms";

export type GateLightSnapshot = {
  on: boolean;
  effectName: string;
  brightness: number | null;
  r: number | null;
  g: number | null;
  b: number | null;
};

const gateTestsInFlight = new Map<string, Promise<{ ok: boolean }>>();

function resolveEsphomeBrightness(brightnessPercent?: number): number {
  const percent = brightnessPercent ?? getDefaultBrightnessPercent();
  return percentToEsphome(percent);
}

function entityPath(entity: string) {
  return encodeURIComponent(entity);
}

function hostBase(host: string) {
  return host.startsWith("http") ? host : `http://${host}`;
}

function commandTimeoutMs() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_TIMEOUT_MS ?? 800);
}

function commandRetries() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_RETRIES ?? 2);
}

function commandRetryDelayMs() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_RETRY_DELAY_MS ?? 150);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

function describeFetchTarget(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function esphomeFetch(
  url: string,
  init: RequestInit = {},
  options: { retries?: number } = {},
): Promise<Response> {
  const timeoutMs = commandTimeoutMs();
  const retries = options.retries ?? commandRetries();
  const delayMs = commandRetryDelayMs();
  const attempts = retries + 1;
  const target = describeFetchTarget(url);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok || !isRetryableStatus(res.status) || attempt === attempts) {
        return res;
      }
      logger.warn(
        "esphome",
        `HTTP ${res.status} ${target} attempt ${attempt}/${attempts}, retrying`,
      );
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
      logger.warn(
        "esphome",
        `${errorMessage(err)} ${target} attempt ${attempt}/${attempts}, retrying`,
      );
    }
    if (attempt < attempts && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ESPHome request failed");
}

function paramValueForEntity(
  param: EffectParamDef,
  value: number | boolean,
): number {
  if (param.type === "bool") return value ? 1 : 0;
  return typeof value === "number" ? value : 0;
}

async function setEffectParamEntity(
  base: string,
  param: EffectParamDef,
  value: number | boolean,
  options: { retries?: number } = {},
): Promise<void> {
  if (!param.entityName || param.yamlOnly) return;

  if (param.type === "bool") {
    const action = value ? "turn_on" : "turn_off";
    const url = `${base}/switch/${entityPath(param.entityName)}/${action}`;
    await esphomeFetch(url, { method: "POST" }, options);
    return;
  }

  const url = `${base}/number/${entityPath(param.entityName)}/set?value=${paramValueForEntity(param, value)}`;
  await esphomeFetch(url, { method: "POST" }, options);
}

async function writeEffectParams(
  host: string,
  effectId: string,
  params: Record<string, number | boolean>,
): Promise<void> {
  const effect = EFFECT_BY_ID.get(effectId);
  if (!effect) return;
  const base = hostBase(host);
  await Promise.all(
    effect.params
      .filter((param) => param.key !== STROBE_START_DELAY_KEY)
      .map((param) => {
        const value = params[param.key];
        if (value === undefined) return Promise.resolve();
        return setEffectParamEntity(base, param, value);
      }),
  );
  const startDelayParam = effect.params.find(
    (param) => param.key === STROBE_START_DELAY_KEY,
  );
  if (startDelayParam && params[STROBE_START_DELAY_KEY] !== undefined) {
    await setEffectParamEntity(
      base,
      startDelayParam,
      params[STROBE_START_DELAY_KEY],
      { retries: 0 },
    );
  }
}

export async function sendEsphomeCommand(
  host: string,
  command: EsphomeCommand,
): Promise<Response> {
  const base = hostBase(host);
  const entitySeg = entityPath(DEFAULT_LIGHT_ENTITY);

  if (command.kind === "off") {
    const url = `${base}/light/${entitySeg}/turn_off`;
    return esphomeFetch(url, {
      method: "POST",
      headers: { "Content-Length": "0" },
    });
  }

  if (command.kind === "effect") {
    const effect = EFFECT_BY_ID.get(command.effectId);
    if (!effect) {
      throw new Error(`Unknown effect: ${command.effectId}`);
    }

    const params = mergeEffectParams(command.effectId, command.params);
    await writeEffectParams(host, command.effectId, params);

    const q = new URLSearchParams({
      effect: effect.name,
      brightness: String(resolveEsphomeBrightness(command.brightnessPercent)),
      transition: "0",
    });
    if (command.r !== undefined) {
      q.set("color_mode", "rgb");
      q.set("r", String(command.r));
      q.set("g", String(command.g));
      q.set("b", String(command.b));
    }

    const url = `${base}/light/${entitySeg}/turn_on?${q}`;
    return esphomeFetch(url, {
      method: "POST",
      headers: { "Content-Length": "0" },
    });
  }

  const q = new URLSearchParams({
    effect: "None",
    color_mode: "rgb",
    r: String(command.r),
    g: String(command.g),
    b: String(command.b),
    brightness: String(resolveEsphomeBrightness(command.brightnessPercent)),
    transition: "0",
  });
  const url = `${base}/light/${entitySeg}/turn_on?${q}`;
  return esphomeFetch(url, {
    method: "POST",
    headers: { "Content-Length": "0" },
  });
}

export async function pingGate(host: string): Promise<boolean> {
  const base = hostBase(host);
  const timeoutMs = Number(process.env.GATESTAGE_GATE_PING_TIMEOUT_MS ?? 800);
  const lightPath = `/light/${entityPath(DEFAULT_LIGHT_ENTITY)}`;
  for (const path of [lightPath, "/health", "/"]) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return true;
    } catch {
      // try next path
    }
  }
  return false;
}

function parseChannel(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 255);
  return Math.round(Math.min(255, Math.max(0, value)));
}

function parseNumberValue(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.value === "number" && Number.isFinite(obj.value)) {
    return obj.value;
  }
  if (typeof obj.state === "number" && Number.isFinite(obj.state)) {
    return obj.state;
  }
  if (typeof obj.state === "string") {
    const parsed = Number(obj.state);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseLightStateJson(raw: unknown): GateLightSnapshot {
  if (!raw || typeof raw !== "object") {
    return {
      on: false,
      effectName: "None",
      brightness: null,
      r: null,
      g: null,
      b: null,
    };
  }
  const obj = raw as Record<string, unknown>;
  const state = String(obj.state ?? "OFF").toUpperCase();
  const on = state === "ON" || obj.state === true;
  const effectName =
    typeof obj.effect === "string" && obj.effect.trim() !== ""
      ? obj.effect
      : "None";
  const brightness = parseChannel(obj.brightness);
  const colorSrc =
    obj.color && typeof obj.color === "object"
      ? (obj.color as Record<string, unknown>)
      : obj;
  return {
    on,
    effectName,
    brightness,
    r: parseChannel(colorSrc.r),
    g: parseChannel(colorSrc.g),
    b: parseChannel(colorSrc.b),
  };
}

export async function getLightState(host: string): Promise<GateLightSnapshot> {
  const url = `${hostBase(host)}/light/${entityPath(DEFAULT_LIGHT_ENTITY)}`;
  const res = await esphomeFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Light state HTTP ${res.status}`);
  }
  return parseLightStateJson(await res.json());
}

async function getNumberValue(
  host: string,
  entityName: string,
): Promise<number | null> {
  const url = `${hostBase(host)}/number/${entityPath(entityName)}`;
  try {
    const res = await esphomeFetch(url, { method: "GET" });
    if (!res.ok) return null;
    return parseNumberValue(await res.json());
  } catch {
    return null;
  }
}

async function snapshotStrobeParams(
  host: string,
): Promise<Record<string, number>> {
  const effect = EFFECT_BY_ID.get("strobe");
  if (!effect) return {};
  const entries = await Promise.all(
    effect.params.map(async (param) => {
      const fallback = typeof param.default === "number" ? param.default : 0;
      if (!param.entityName) return [param.key, fallback] as const;
      const value = await getNumberValue(host, param.entityName);
      return [param.key, value ?? fallback] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function turnOnLight(
  host: string,
  opts: {
    effect: string;
    brightness?: number | null;
    r?: number | null;
    g?: number | null;
    b?: number | null;
  },
): Promise<Response> {
  const q = new URLSearchParams({
    effect: opts.effect,
    transition: "0",
  });
  if (opts.brightness != null) {
    q.set("brightness", String(opts.brightness));
  }
  if (opts.r != null && opts.g != null && opts.b != null) {
    q.set("color_mode", "rgb");
    q.set("r", String(opts.r));
    q.set("g", String(opts.g));
    q.set("b", String(opts.b));
  }
  const url = `${hostBase(host)}/light/${entityPath(DEFAULT_LIGHT_ENTITY)}/turn_on?${q}`;
  return esphomeFetch(url, {
    method: "POST",
    headers: { "Content-Length": "0" },
  });
}

async function restoreLightSnapshot(
  host: string,
  snapshot: GateLightSnapshot,
  strobeParams: Record<string, number>,
): Promise<Response> {
  await writeEffectParams(host, "strobe", strobeParams);
  if (!snapshot.on) {
    return sendEsphomeCommand(host, { kind: "off" });
  }

  const effect = EFFECT_BY_NAME.get(snapshot.effectName);
  const includeColor =
    snapshot.effectName === "None" || Boolean(effect?.supportsColor);
  const hasColor =
    includeColor &&
    snapshot.r != null &&
    snapshot.g != null &&
    snapshot.b != null;

  if (snapshot.effectName && snapshot.effectName !== "None") {
    return turnOnLight(host, {
      effect: snapshot.effectName,
      brightness: snapshot.brightness,
      ...(hasColor ? { r: snapshot.r, g: snapshot.g, b: snapshot.b } : {}),
    });
  }

  if (hasColor) {
    return turnOnLight(host, {
      effect: "None",
      brightness: snapshot.brightness,
      r: snapshot.r,
      g: snapshot.g,
      b: snapshot.b,
    });
  }

  return turnOnLight(host, {
    effect: "None",
    brightness: snapshot.brightness,
  });
}

function testDurationMs(): number {
  const parsed = Number(
    process.env.GATESTAGE_GATE_TEST_DURATION_MS ?? GATE_TEST_DURATION_MS,
  );
  if (!Number.isFinite(parsed) || parsed < 0) return GATE_TEST_DURATION_MS;
  return parsed;
}

async function runGateTest(host: string): Promise<{ ok: boolean }> {
  const snapshot = await getLightState(host);
  const strobeParams = await snapshotStrobeParams(host);

  const strobeRes = await sendEsphomeCommand(host, {
    kind: "effect",
    effectId: "strobe",
    params: {
      period_ms: GATE_TEST_STROBE_PERIOD_MS,
      on_ms: GATE_TEST_STROBE_ON_MS,
      start_delay_ms: 0,
    },
    brightnessPercent: GATE_TEST_BRIGHTNESS_PERCENT,
    ...GATE_TEST_COLOR,
  });
  if (!strobeRes.ok) {
    throw new Error(`Strobe HTTP ${strobeRes.status}`);
  }

  const durationMs = testDurationMs();
  if (durationMs > 0) await sleep(durationMs);

  const restoreRes = await restoreLightSnapshot(host, snapshot, strobeParams);
  if (!restoreRes.ok) {
    throw new Error(`Restore HTTP ${restoreRes.status}`);
  }
  return { ok: true };
}

/** Snapshot the gate, strobe it quickly, then restore the previous light state. */
export async function testGate(host: string): Promise<{ ok: boolean }> {
  const existing = gateTestsInFlight.get(host);
  if (existing) return existing;

  const run = runGateTest(host).finally(() => {
    gateTestsInFlight.delete(host);
  });
  gateTestsInFlight.set(host, run);
  return run;
}
